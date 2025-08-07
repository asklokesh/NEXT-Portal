#!/bin/bash
set -euo pipefail

# Restore script for Backstage IDP Platform
# Usage: ./restore.sh [environment] [backup-timestamp]
# Example: ./restore.sh production 20240101-120000

ENVIRONMENT=${1:-production}
BACKUP_TIMESTAMP=${2:-latest}
BACKUP_BASE_DIR="/backups/${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
log() {
 echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
 echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
 echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

info() {
 echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Find backup directory
find_backup_dir() {
 if [ "${BACKUP_TIMESTAMP}" == "latest" ]; then
 BACKUP_DIR=$(find "${BACKUP_BASE_DIR}" -maxdepth 1 -type d | sort -r | head -n 2 | tail -n 1)
 if [ -z "${BACKUP_DIR}" ]; then
 error "No backups found in ${BACKUP_BASE_DIR}"
 exit 1
 fi
 BACKUP_TIMESTAMP=$(basename "${BACKUP_DIR}")
 else
 BACKUP_DIR="${BACKUP_BASE_DIR}/${BACKUP_TIMESTAMP}"
 if [ ! -d "${BACKUP_DIR}" ]; then
 error "Backup not found: ${BACKUP_DIR}"
 exit 1
 fi
 fi
 
 log "Using backup: ${BACKUP_DIR}"
}

# Verify backup integrity
verify_backup() {
 log "Verifying backup integrity..."
 
 if [ ! -f "${BACKUP_DIR}/manifest.json" ]; then
 error "Backup manifest not found!"
 exit 1
 fi
 
 # Check manifest checksum
 local expected_checksum=$(jq -r '.checksum' "${BACKUP_DIR}/manifest.json")
 local actual_checksum=$(find "${BACKUP_DIR}" -type f ! -name "manifest.json" -exec md5sum {} \; | md5sum | cut -d' ' -f1)
 
 if [ "${expected_checksum}" != "${actual_checksum}" ]; then
 warn "Checksum mismatch! Backup may be corrupted."
 read -p "Continue anyway? (y/N) " -n 1 -r
 echo
 if [[ ! $REPLY =~ ^[Yy]$ ]]; then
 exit 1
 fi
 else
 log "Backup integrity verified"
 fi
}

# Create restore point
create_restore_point() {
 log "Creating restore point before restoration..."
 
 RESTORE_POINT_DIR="/backups/${ENVIRONMENT}/restore-points/$(date +%Y%m%d-%H%M%S)"
 mkdir -p "${RESTORE_POINT_DIR}"
 
 # Quick backup of current state
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 kubectl exec -n backstage-idp postgres-0 -- \
 pg_dump -U backstage_user backstage_idp \
 | gzip > "${RESTORE_POINT_DIR}/database-current.sql.gz"
 fi
 
 log "Restore point created: ${RESTORE_POINT_DIR}"
}

# Restore database
restore_database() {
 local db_backup=$(find "${BACKUP_DIR}" -name "database-*.sql.gz" | head -n 1)
 
 if [ -z "${db_backup}" ]; then
 warn "No database backup found, skipping..."
 return
 fi
 
 log "Restoring database from: $(basename ${db_backup})"
 
 # Stop application to prevent connections
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 log "Scaling down application..."
 kubectl scale deployment backstage-idp -n backstage-idp --replicas=0
 sleep 10
 fi
 
 # Drop existing connections
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 kubectl exec -n backstage-idp postgres-0 -- psql -U backstage_user -d postgres -c \
 "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'backstage_idp' AND pid <> pg_backend_pid();"
 fi
 
 # Restore database
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 gunzip -c "${db_backup}" | kubectl exec -i -n backstage-idp postgres-0 -- \
 psql -U backstage_user -d backstage_idp
 else
 gunzip -c "${db_backup}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
 -h "${POSTGRES_HOST}" \
 -U "${POSTGRES_USER}" \
 -d "${POSTGRES_DB}"
 fi
 
 log "Database restored successfully"
}

# Restore Redis
restore_redis() {
 local redis_backup=$(find "${BACKUP_DIR}" -name "redis-*.rdb" | head -n 1)
 
 if [ -z "${redis_backup}" ]; then
 warn "No Redis backup found, skipping..."
 return
 fi
 
 log "Restoring Redis from: $(basename ${redis_backup})"
 
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 # Stop Redis to replace dump file
 kubectl exec -n backstage-idp redis-0 -- redis-cli SHUTDOWN SAVE
 sleep 5
 
 # Copy backup file
 kubectl cp "${redis_backup}" backstage-idp/redis-0:/data/dump.rdb
 
 # Restart Redis
 kubectl delete pod redis-0 -n backstage-idp
 kubectl wait --for=condition=ready pod/redis-0 -n backstage-idp --timeout=60s
 else
 redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" SHUTDOWN SAVE
 cp "${redis_backup}" /var/lib/redis/dump.rdb
 systemctl start redis
 fi
 
 log "Redis restored successfully"
}

# Restore application files
restore_application_files() {
 log "Restoring application files..."
 
 local files=("uploads" "logs" "env" "migrations")
 
 for file_type in "${files[@]}"; do
 local backup_file=$(find "${BACKUP_DIR}" -name "*${file_type}*.tar.gz" | head -n 1)
 
 if [ -n "${backup_file}" ]; then
 log "Restoring: $(basename ${backup_file})"
 tar -xzf "${backup_file}" -C /
 fi
 done
}

# Restore Kubernetes configuration
restore_kubernetes_config() {
 if [ "${ENVIRONMENT}" != "kubernetes" ]; then
 return
 fi
 
 log "Restoring Kubernetes configurations..."
 
 # Restore secrets (careful - may contain sensitive data)
 if [ -f "${BACKUP_DIR}/k8s-secrets-${BACKUP_TIMESTAMP}.yaml" ]; then
 warn "Found secrets backup. Review before applying!"
 read -p "Apply secrets? (y/N) " -n 1 -r
 echo
 if [[ $REPLY =~ ^[Yy]$ ]]; then
 kubectl apply -f "${BACKUP_DIR}/k8s-secrets-${BACKUP_TIMESTAMP}.yaml"
 fi
 fi
 
 # Restore configmaps
 if [ -f "${BACKUP_DIR}/k8s-configmaps-${BACKUP_TIMESTAMP}.yaml" ]; then
 kubectl apply -f "${BACKUP_DIR}/k8s-configmaps-${BACKUP_TIMESTAMP}.yaml"
 fi
}

# Run post-restore tasks
post_restore_tasks() {
 log "Running post-restore tasks..."
 
 # Run database migrations
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 kubectl exec -n backstage-idp deploy/backstage-idp -- npx prisma migrate deploy
 else
 cd /app && npx prisma migrate deploy
 fi
 
 # Clear caches
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 kubectl exec -n backstage-idp redis-0 -- redis-cli FLUSHALL
 else
 redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" FLUSHALL
 fi
 
 # Restart application
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 kubectl scale deployment backstage-idp -n backstage-idp --replicas=3
 kubectl rollout status deployment/backstage-idp -n backstage-idp
 else
 systemctl restart backstage-idp
 fi
}

# Verify restoration
verify_restoration() {
 log "Verifying restoration..."
 
 # Check application health
 local health_endpoint="http://localhost:3000/api/health"
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 health_endpoint="http://backstage-idp.example.com/api/health"
 fi
 
 sleep 30 # Wait for application to start
 
 if curl -f "${health_endpoint}" > /dev/null 2>&1; then
 log "Application health check passed"
 else
 error "Application health check failed!"
 return 1
 fi
 
 # Check database connectivity
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 kubectl exec -n backstage-idp postgres-0 -- pg_isready -U backstage_user
 fi
 
 log "Restoration verification completed"
}

# Main execution
main() {
 info "Starting restore process for ${ENVIRONMENT} environment"
 
 # Confirmation prompt
 warn "This will restore from backup timestamp: ${BACKUP_TIMESTAMP}"
 warn "Current data will be overwritten!"
 read -p "Are you sure you want to continue? (y/N) " -n 1 -r
 echo
 if [[ ! $REPLY =~ ^[Yy]$ ]]; then
 exit 0
 fi
 
 find_backup_dir
 verify_backup
 create_restore_point
 
 # Restore components
 restore_database
 restore_redis
 restore_application_files
 restore_kubernetes_config
 
 # Post-restore
 post_restore_tasks
 verify_restoration
 
 log "Restore completed successfully!"
 
 # Send notification
 if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
 curl -X POST "${SLACK_WEBHOOK_URL}" \
 -H 'Content-type: application/json' \
 -d "{
 \"text\": \"Restore completed for ${ENVIRONMENT}\",
 \"attachments\": [{
 \"color\": \"good\",
 \"fields\": [
 {\"title\": \"Environment\", \"value\": \"${ENVIRONMENT}\", \"short\": true},
 {\"title\": \"Backup Timestamp\", \"value\": \"${BACKUP_TIMESTAMP}\", \"short\": true},
 {\"title\": \"Restore Point\", \"value\": \"${RESTORE_POINT_DIR}\", \"short\": false}
 ]
 }]
 }"
 fi
}

# Handle errors
trap 'error "Restore failed! Check logs for details."; exit 1' ERR

# Run main function
main

info "Restore process completed. Please verify all functionality."