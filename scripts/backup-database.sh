#!/bin/bash

# Database Backup Script for SaaS IDP Platform
# Supports both local and S3 backups with encryption

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
S3_BUCKET="${S3_BUCKET:-}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-backstage_idp}"
POSTGRES_USER="${POSTGRES_USER:-backstage_user}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="backup_${POSTGRES_DB}_${TIMESTAMP}"

echo "Starting database backup at $(date)"

# Perform database dump
echo "Creating database dump..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
 -h "$POSTGRES_HOST" \
 -p "$POSTGRES_PORT" \
 -U "$POSTGRES_USER" \
 -d "$POSTGRES_DB" \
 --format=custom \
 --verbose \
 --no-owner \
 --no-privileges \
 --file="${BACKUP_DIR}/${BACKUP_FILENAME}.dump"

# Compress backup
echo "Compressing backup..."
gzip -9 "${BACKUP_DIR}/${BACKUP_FILENAME}.dump"
COMPRESSED_FILE="${BACKUP_DIR}/${BACKUP_FILENAME}.dump.gz"

# Encrypt backup if encryption key is provided
if [ -n "$ENCRYPTION_KEY" ]; then
 echo "Encrypting backup..."
 openssl enc -aes-256-cbc -salt -in "$COMPRESSED_FILE" -out "${COMPRESSED_FILE}.enc" -k "$ENCRYPTION_KEY"
 rm "$COMPRESSED_FILE"
 FINAL_FILE="${COMPRESSED_FILE}.enc"
else
 FINAL_FILE="$COMPRESSED_FILE"
fi

# Calculate checksum
echo "Calculating checksum..."
sha256sum "$FINAL_FILE" > "${FINAL_FILE}.sha256"

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
 echo "Uploading to S3..."
 aws s3 cp "$FINAL_FILE" "s3://${S3_BUCKET}/postgres-backups/${BACKUP_FILENAME}.dump.gz" \
 --storage-class STANDARD_IA
 aws s3 cp "${FINAL_FILE}.sha256" "s3://${S3_BUCKET}/postgres-backups/${BACKUP_FILENAME}.dump.gz.sha256"
fi

# Clean up old local backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "backup_${POSTGRES_DB}_*.dump.gz*" -mtime +$RETENTION_DAYS -delete

# Clean up old S3 backups if configured
if [ -n "$S3_BUCKET" ]; then
 echo "Cleaning up old S3 backups..."
 aws s3 ls "s3://${S3_BUCKET}/postgres-backups/" | \
 awk '{print $4}' | \
 grep "^backup_${POSTGRES_DB}_" | \
 while read -r file; do
 FILE_DATE=$(echo "$file" | grep -oE '[0-9]{8}' | head -1)
 if [ -n "$FILE_DATE" ]; then
 FILE_AGE=$(( ($(date +%s) - $(date -d "$FILE_DATE" +%s)) / 86400 ))
 if [ "$FILE_AGE" -gt "$RETENTION_DAYS" ]; then
 aws s3 rm "s3://${S3_BUCKET}/postgres-backups/$file"
 fi
 fi
 done
fi

# Backup verification
echo "Verifying backup..."
if [ -f "$FINAL_FILE" ]; then
 FILE_SIZE=$(stat -f%z "$FINAL_FILE" 2>/dev/null || stat -c%s "$FINAL_FILE")
 echo "Backup completed successfully!"
 echo "File: $FINAL_FILE"
 echo "Size: $(numfmt --to=iec-i --suffix=B $FILE_SIZE)"
 echo "Checksum: $(cat ${FINAL_FILE}.sha256 | cut -d' ' -f1)"
else
 echo "ERROR: Backup file not found!"
 exit 1
fi

# Send notification (if webhook URL is configured)
if [ -n "${BACKUP_WEBHOOK_URL:-}" ]; then
 curl -X POST "$BACKUP_WEBHOOK_URL" \
 -H "Content-Type: application/json" \
 -d "{
 \"text\": \"Database backup completed\",
 \"backup\": {
 \"database\": \"$POSTGRES_DB\",
 \"timestamp\": \"$TIMESTAMP\",
 \"size\": \"$FILE_SIZE\",
 \"location\": \"${S3_BUCKET:-local}\"
 }
 }"
fi

echo "Backup process completed at $(date)"