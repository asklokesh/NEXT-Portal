#!/bin/bash
set -euo pipefail

# Backup script for Backstage IDP Platform
# Usage: ./backup.sh [environment] [backup-type]
# Example: ./backup.sh production full

ENVIRONMENT=${1:-production}
BACKUP_TYPE=${2:-full}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/${ENVIRONMENT}/${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Create backup directory
mkdir -p "${BACKUP_DIR}"

log "Starting ${BACKUP_TYPE} backup for ${ENVIRONMENT} environment"

# 1. Database backup
backup_database() {
 log "Backing up PostgreSQL database..."
 
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 kubectl exec -n backstage-idp postgres-0 -- \
 pg_dump -U backstage_user backstage_idp \
 > "${BACKUP_DIR}/database-${TIMESTAMP}.sql"
 else
 PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
 -h "${POSTGRES_HOST}" \
 -U "${POSTGRES_USER}" \
 -d "${POSTGRES_DB}" \
 -f "${BACKUP_DIR}/database-${TIMESTAMP}.sql" \
 --verbose \
 --no-owner \
 --no-privileges
 fi
 
 # Compress the backup
 gzip "${BACKUP_DIR}/database-${TIMESTAMP}.sql"
 
 log "Database backup completed: database-${TIMESTAMP}.sql.gz"
}

# 2. Redis backup
backup_redis() {
 log "Backing up Redis data..."
 
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 kubectl exec -n backstage-idp redis-0 -- \
 redis-cli --rdb "${BACKUP_DIR}/redis-${TIMESTAMP}.rdb" BGSAVE
 
 # Wait for backup to complete
 sleep 5
 
 kubectl cp backstage-idp/redis-0:/data/dump.rdb \
 "${BACKUP_DIR}/redis-${TIMESTAMP}.rdb"
 else
 redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" \
 --rdb "${BACKUP_DIR}/redis-${TIMESTAMP}.rdb" BGSAVE
 fi
 
 log "Redis backup completed: redis-${TIMESTAMP}.rdb"
}

# 3. Application files backup
backup_application() {
 log "Backing up application files..."
 
 # List of directories to backup
 DIRS_TO_BACKUP=(
 "public/uploads"
 "logs"
 ".env.production"
 "prisma/migrations"
 )
 
 for dir in "${DIRS_TO_BACKUP[@]}"; do
 if [ -e "${dir}" ]; then
 tar -czf "${BACKUP_DIR}/$(basename ${dir})-${TIMESTAMP}.tar.gz" "${dir}"
 log "Backed up: ${dir}"
 else
 warn "Directory not found: ${dir}"
 fi
 done
}

# 4. Kubernetes configuration backup
backup_kubernetes() {
 if [ "${ENVIRONMENT}" == "kubernetes" ]; then
 log "Backing up Kubernetes configurations..."
 
 # Backup secrets
 kubectl get secrets -n backstage-idp -o yaml \
 > "${BACKUP_DIR}/k8s-secrets-${TIMESTAMP}.yaml"
 
 # Backup configmaps
 kubectl get configmaps -n backstage-idp -o yaml \
 > "${BACKUP_DIR}/k8s-configmaps-${TIMESTAMP}.yaml"
 
 # Backup persistent volume claims
 kubectl get pvc -n backstage-idp -o yaml \
 > "${BACKUP_DIR}/k8s-pvc-${TIMESTAMP}.yaml"
 
 log "Kubernetes configuration backup completed"
 fi
}

# 5. Create backup manifest
create_manifest() {
 log "Creating backup manifest..."
 
 cat > "${BACKUP_DIR}/manifest.json" <<EOF
{
 "timestamp": "${TIMESTAMP}",
 "environment": "${ENVIRONMENT}",
 "backup_type": "${BACKUP_TYPE}",
 "files": [
 $(find "${BACKUP_DIR}" -type f -name "*.gz" -o -name "*.rdb" -o -name "*.yaml" | \
 sed "s|${BACKUP_DIR}/||g" | \
 awk '{print "\"" $0 "\""}' | \
 paste -sd "," -)
 ],
 "size": "$(du -sh ${BACKUP_DIR} | cut -f1)",
 "checksum": "$(find ${BACKUP_DIR} -type f -exec md5sum {} \; | md5sum | cut -d' ' -f1)"
}
EOF
}

# 6. Upload to cloud storage
upload_to_cloud() {
 log "Uploading backup to cloud storage..."
 
 # AWS S3
 if [ -n "${AWS_BACKUP_BUCKET:-}" ]; then
 aws s3 sync "${BACKUP_DIR}" "s3://${AWS_BACKUP_BUCKET}/backups/${ENVIRONMENT}/${TIMESTAMP}/" \
 --storage-class STANDARD_IA
 log "Backup uploaded to S3: ${AWS_BACKUP_BUCKET}"
 fi
 
 # Google Cloud Storage
 if [ -n "${GCS_BACKUP_BUCKET:-}" ]; then
 gsutil -m rsync -r "${BACKUP_DIR}" "gs://${GCS_BACKUP_BUCKET}/backups/${ENVIRONMENT}/${TIMESTAMP}/"
 log "Backup uploaded to GCS: ${GCS_BACKUP_BUCKET}"
 fi
 
 # Azure Blob Storage
 if [ -n "${AZURE_BACKUP_CONTAINER:-}" ]; then
 az storage blob upload-batch \
 --destination "${AZURE_BACKUP_CONTAINER}" \
 --destination-path "backups/${ENVIRONMENT}/${TIMESTAMP}" \
 --source "${BACKUP_DIR}"
 log "Backup uploaded to Azure: ${AZURE_BACKUP_CONTAINER}"
 fi
}

# 7. Cleanup old backups
cleanup_old_backups() {
 log "Cleaning up old backups..."
 
 # Keep only last 30 days of backups locally
 find /backups -type d -mtime +30 -exec rm -rf {} \; 2>/dev/null || true
 
 # Cloud storage lifecycle policies should handle remote cleanup
}

# 8. Send notification
send_notification() {
 local status=$1
 local message=$2
 
 # Slack notification
 if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
 curl -X POST "${SLACK_WEBHOOK_URL}" \
 -H 'Content-type: application/json' \
 -d "{
 \"text\": \"Backup ${status} for ${ENVIRONMENT}\",
 \"attachments\": [{
 \"color\": \"$([ ${status} == 'completed' ] && echo 'good' || echo 'danger')\",
 \"fields\": [
 {\"title\": \"Environment\", \"value\": \"${ENVIRONMENT}\", \"short\": true},
 {\"title\": \"Type\", \"value\": \"${BACKUP_TYPE}\", \"short\": true},
 {\"title\": \"Timestamp\", \"value\": \"${TIMESTAMP}\", \"short\": true},
 {\"title\": \"Message\", \"value\": \"${message}\", \"short\": false}
 ]
 }]
 }"
 fi
}

# Main execution
main() {
 trap 'error "Backup failed!"; send_notification "failed" "Backup process failed"; exit 1' ERR
 
 case "${BACKUP_TYPE}" in
 full)
 backup_database
 backup_redis
 backup_application
 backup_kubernetes
 ;;
 database)
 backup_database
 ;;
 redis)
 backup_redis
 ;;
 application)
 backup_application
 ;;
 *)
 error "Unknown backup type: ${BACKUP_TYPE}"
 exit 1
 ;;
 esac
 
 create_manifest
 upload_to_cloud
 cleanup_old_backups
 
 log "Backup completed successfully!"
 send_notification "completed" "Backup stored in ${BACKUP_DIR}"
}

# Run main function
main

# Backup verification
log "Verifying backup integrity..."
if [ -f "${BACKUP_DIR}/manifest.json" ]; then
 log "Backup manifest verified"
else
 error "Backup manifest missing!"
 exit 1
fi

log "Backup process completed successfully!"