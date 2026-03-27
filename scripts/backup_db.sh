#!/bin/bash

# PostgreSQL Database Backup Script
# Methna App - Automated Daily Backup
# Usage: ./backup_db.sh [dev|prod]

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-dev}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/methna"
LOG_FILE="/var/log/methna_backup.log"
RETENTION_DAYS=14

# Database credentials (set as environment variables)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-methna_${ENVIRONMENT}}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "methna_${ENVIRONMENT}_*.sql" -type f -mtime +$RETENTION_DAYS -delete
    log "Cleanup completed"
}

# Function to create backup
create_backup() {
    local backup_file="${BACKUP_DIR}/methna_${ENVIRONMENT}_${TIMESTAMP}.sql"
    
    log "Starting database backup for ${ENVIRONMENT} environment..."
    log "Backup file: $backup_file"
    
    # Set password if provided
    if [[ -n "$DB_PASSWORD" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    
    # Create compressed backup
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --clean --if-exists --no-owner --no-privileges \
            --format=custom --compress=9 \
            --file="$backup_file" 2>&1 | tee -a "$LOG_FILE"; then
        
        # Verify backup file exists and is not empty
        if [[ -f "$backup_file" && -s "$backup_file" ]]; then
            local backup_size=$(du -h "$backup_file" | cut -f1)
            log "Backup completed successfully. Size: $backup_size"
            
            # Create checksum for integrity verification
            sha256sum "$backup_file" > "${backup_file}.sha256"
            log "Checksum created: ${backup_file}.sha256"
            
            return 0
        else
            log "ERROR: Backup file is empty or missing"
            return 1
        fi
    else
        log "ERROR: Backup creation failed"
        return 1
    fi
}

# Function to verify backup
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup integrity..."
    
    # Check if we can restore the backup structure (without actually restoring)
    if pg_restore --list "$backup_file" > /dev/null 2>&1; then
        log "Backup verification successful"
        return 0
    else
        log "ERROR: Backup verification failed"
        return 1
    fi
}

# Main execution
main() {
    log "=== Database Backup Started ==="
    log "Environment: $ENVIRONMENT"
    log "Database: $DB_NAME@$DB_HOST:$DB_PORT"
    
    # Create backup
    if create_backup; then
        local backup_file="${BACKUP_DIR}/methna_${ENVIRONMENT}_${TIMESTAMP}.sql"
        
        # Verify backup
        if verify_backup "$backup_file"; then
            # Cleanup old backups
            cleanup_old_backups
            
            log "=== Backup Process Completed Successfully ==="
            exit 0
        else
            log "ERROR: Backup verification failed"
            exit 1
        fi
    else
        log "ERROR: Backup creation failed"
        exit 1
    fi
}

# Execute main function
main "$@"
