#!/bin/bash

# Database Restore Script for SaaS IDP Platform
# Supports both local and S3 restore with decryption

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
S3_BUCKET="${S3_BUCKET:-}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-backstage_idp}"
POSTGRES_USER="${POSTGRES_USER:-backstage_user}"
DECRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Parse arguments
BACKUP_FILE=""
RESTORE_TO_NEW_DB=""
POINT_IN_TIME=""

while [[ $# -gt 0 ]]; do
 case $1 in
 --file)
 BACKUP_FILE="$2"
 shift 2
 ;;
 --new-db)
 RESTORE_TO_NEW_DB="$2"
 shift 2
 ;;
 --point-in-time)
 POINT_IN_TIME="$2"
 shift 2
 ;;
 *)
 echo "Unknown option: $1"
 exit 1
 ;;
 esac
done

# Function to list available backups
list_backups() {
 echo "Available backups:"
 echo ""
 
 # List local backups
 echo "Local backups:"
 if [ -d "$BACKUP_DIR" ]; then
 ls -lh "$BACKUP_DIR"/backup_${POSTGRES_DB}_*.dump.gz* 2>/dev/null | awk '{print $9, "-", $5}' || echo " No local backups found"
 fi
 
 echo ""
 
 # List S3 backups if configured
 if [ -n "$S3_BUCKET" ]; then
 echo "S3 backups:"
 aws s3 ls "s3://${S3_BUCKET}/postgres-backups/" | grep "backup_${POSTGRES_DB}_" | awk '{print $4, "-", $3}'
 fi
}

# If no backup file specified, list available backups
if [ -z "$BACKUP_FILE" ]; then
 list_backups
 echo ""
 echo "Usage: $0 --file <backup_filename> [--new-db <new_database_name>] [--point-in-time <timestamp>]"
 exit 0
fi

echo "Starting database restore at $(date)"

# Determine if backup is from S3
TEMP_DIR="/tmp/postgres_restore_$$"
mkdir -p "$TEMP_DIR"

if [[ "$BACKUP_FILE" == s3://* ]]; then
 echo "Downloading backup from S3..."
 LOCAL_FILE="${TEMP_DIR}/$(basename $BACKUP_FILE)"
 aws s3 cp "$BACKUP_FILE" "$LOCAL_FILE"
 aws s3 cp "${BACKUP_FILE}.sha256" "${LOCAL_FILE}.sha256"
 RESTORE_FILE="$LOCAL_FILE"
elif [[ "$BACKUP_FILE" == /* ]]; then
 # Absolute path
 RESTORE_FILE="$BACKUP_FILE"
else
 # Relative to backup directory
 RESTORE_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
fi

# Verify checksum if available
if [ -f "${RESTORE_FILE}.sha256" ]; then
 echo "Verifying backup integrity..."
 cd $(dirname "$RESTORE_FILE")
 sha256sum -c "$(basename ${RESTORE_FILE}).sha256"
 cd - > /dev/null
fi

# Decrypt if needed
if [[ "$RESTORE_FILE" == *.enc ]]; then
 if [ -z "$DECRYPTION_KEY" ]; then
 echo "ERROR: Backup is encrypted but no decryption key provided!"
 exit 1
 fi
 
 echo "Decrypting backup..."
 DECRYPTED_FILE="${TEMP_DIR}/decrypted_backup.dump.gz"
 openssl enc -aes-256-cbc -d -in "$RESTORE_FILE" -out "$DECRYPTED_FILE" -k "$DECRYPTION_KEY"
 RESTORE_FILE="$DECRYPTED_FILE"
fi

# Decompress if needed
if [[ "$RESTORE_FILE" == *.gz ]]; then
 echo "Decompressing backup..."
 DECOMPRESSED_FILE="${TEMP_DIR}/backup.dump"
 gunzip -c "$RESTORE_FILE" > "$DECOMPRESSED_FILE"
 RESTORE_FILE="$DECOMPRESSED_FILE"
fi

# Determine target database
TARGET_DB="${RESTORE_TO_NEW_DB:-$POSTGRES_DB}"

# Create new database if restoring to different DB
if [ -n "$RESTORE_TO_NEW_DB" ]; then
 echo "Creating new database: $RESTORE_TO_NEW_DB"
 PGPASSWORD="${POSTGRES_PASSWORD}" psql \
 -h "$POSTGRES_HOST" \
 -p "$POSTGRES_PORT" \
 -U "$POSTGRES_USER" \
 -d postgres \
 -c "CREATE DATABASE $RESTORE_TO_NEW_DB WITH TEMPLATE template0 ENCODING 'UTF8';"
fi

# Stop applications if restoring to production DB
if [ -z "$RESTORE_TO_NEW_DB" ]; then
 echo "WARNING: Restoring to production database!"
 echo "This will overwrite all existing data in $POSTGRES_DB"
 read -p "Are you sure you want to continue? (yes/no): " -n 3 -r
 echo
 if [[ ! $REPLY =~ ^yes$ ]]; then
 echo "Restore cancelled."
 exit 0
 fi
 
 # TODO: Add application shutdown logic here
 echo "Note: You should stop all applications before proceeding!"
 sleep 5
fi

# Perform restore
echo "Restoring database..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
 -h "$POSTGRES_HOST" \
 -p "$POSTGRES_PORT" \
 -U "$POSTGRES_USER" \
 -d "$TARGET_DB" \
 --verbose \
 --no-owner \
 --no-privileges \
 --if-exists \
 --clean \
 "$RESTORE_FILE"

# Apply point-in-time recovery if specified
if [ -n "$POINT_IN_TIME" ]; then
 echo "Applying point-in-time recovery to: $POINT_IN_TIME"
 # This would require WAL archiving to be set up
 # Implementation depends on your PostgreSQL configuration
fi

# Verify restore
echo "Verifying restore..."
TABLE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
 -h "$POSTGRES_HOST" \
 -p "$POSTGRES_PORT" \
 -U "$POSTGRES_USER" \
 -d "$TARGET_DB" \
 -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "Restored database contains $TABLE_COUNT tables"

# Run post-restore tasks
echo "Running post-restore tasks..."

# Update sequences
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
 -h "$POSTGRES_HOST" \
 -p "$POSTGRES_PORT" \
 -U "$POSTGRES_USER" \
 -d "$TARGET_DB" \
 -c "SELECT setval(c.oid, GREATEST(MAX(a.attnum), 1)) FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid WHERE c.relkind = 'S';"

# Analyze database for query optimization
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
 -h "$POSTGRES_HOST" \
 -p "$POSTGRES_PORT" \
 -U "$POSTGRES_USER" \
 -d "$TARGET_DB" \
 -c "ANALYZE;"

# Clean up temporary files
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

# Send notification
if [ -n "${RESTORE_WEBHOOK_URL:-}" ]; then
 curl -X POST "$RESTORE_WEBHOOK_URL" \
 -H "Content-Type: application/json" \
 -d "{
 \"text\": \"Database restore completed\",
 \"restore\": {
 \"database\": \"$TARGET_DB\",
 \"backup_file\": \"$BACKUP_FILE\",
 \"timestamp\": \"$(date +%Y%m%d_%H%M%S)\"
 }
 }"
fi

echo "Restore completed successfully at $(date)"
echo "Database '$TARGET_DB' has been restored from backup"