#!/bin/bash

# PostgreSQL Database Restore Script
# Methna App - Database Restore from Backup
# Usage: ./restore_db.sh <backup_file> [dev|prod]

set -euo pipefail

# Check arguments
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <backup_file> [environment]"
    echo "Example: $0 /var/backups/methna/methna_dev_20260327_120000.sql dev"
    echo "Available backups:"
    ls -la /var/backups/methna/methna_*.sql 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
ENVIRONMENT=${2:-dev}
LOG_FILE="/var/log/methna_restore.log"

# Database configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-methna_${ENVIRONMENT}}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-}

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to verify backup file exists
verify_backup_file() {
    if [[ ! -f "$BACKUP_FILE" ]]; then
        log "ERROR: Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    # Check if checksum exists and verify
    local checksum_file="${BACKUP_FILE}.sha256"
    if [[ -f "$checksum_file" ]]; then
        log "Verifying backup integrity with checksum..."
        if sha256sum -c "$checksum_file" > /dev/null 2>&1; then
            log "Backup integrity verified"
        else
            log "ERROR: Backup integrity check failed"
            exit 1
        fi
    else
        log "WARNING: No checksum file found, proceeding without integrity check"
    fi
}

# Function to create database backup before restore
pre_restore_backup() {
    local pre_backup="${BACKUP_DIR}/methna_${ENVIRONMENT}_pre_restore_$(date +%Y%m%d_%H%M%S).sql"
    log "Creating pre-restore backup: $pre_backup"
    
    if [[ -n "$DB_PASSWORD" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --clean --if-exists --no-owner --no-privileges \
            --format=custom --compress=9 \
            --file="$pre_backup" 2>&1 | tee -a "$LOG_FILE"; then
        log "Pre-restore backup created successfully"
        return 0
    else
        log "WARNING: Failed to create pre-restore backup"
        return 1
    fi
}

# Function to restore database
restore_database() {
    log "Starting database restore from: $BACKUP_FILE"
    log "Target database: $DB_NAME"
    
    # Set password if provided
    if [[ -n "$DB_PASSWORD" ]]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    
    # Drop and recreate database (clean restore)
    log "Dropping existing database..."
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>&1 | tee -a "$LOG_FILE"; then
        
        log "Creating new database..."
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
                -c "CREATE DATABASE $DB_NAME;" 2>&1 | tee -a "$LOG_FILE"; then
            
            log "Restoring database from backup..."
            if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                    --verbose --clean --if-exists --no-owner --no-privileges \
                    "$BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE"; then
                
                log "Database restore completed successfully"
                return 0
            else
                log "ERROR: Database restore failed"
                return 1
            fi
        else
            log "ERROR: Failed to create database"
            return 1
        fi
    else
        log "ERROR: Failed to drop database"
        return 1
    fi
}

# Function to verify restore
verify_restore() {
    log "Verifying database restore..."
    
    # Check if database exists and has tables
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    
    if [[ "$table_count" -gt 0 ]]; then
        log "Database restore verified. Found $table_count tables"
        return 0
    else
        log "ERROR: Database restore verification failed - no tables found"
        return 1
    fi
}

# Main execution
main() {
    log "=== Database Restore Started ==="
    log "Backup file: $BACKUP_FILE"
    log "Environment: $ENVIRONMENT"
    log "Target database: $DB_NAME"
    
    # Verify backup file
    verify_backup_file
    
    # Create pre-restore backup
    pre_restore_backup || true  # Continue even if pre-backup fails
    
    # Restore database
    if restore_database; then
        # Verify restore
        if verify_restore; then
            log "=== Database Restore Completed Successfully ==="
            log "Database $DB_NAME has been restored from $BACKUP_FILE"
            exit 0
        else
            log "ERROR: Database restore verification failed"
            exit 1
        fi
    else
        log "ERROR: Database restore failed"
        exit 1
    fi
}

# Execute main function
main "$@"
