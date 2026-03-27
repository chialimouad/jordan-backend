#!/bin/bash

# Methna App Backup Verification Script
# Verifies backup integrity and sends alerts if issues found

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/methna"
LOG_FILE="/var/log/methna_backup.log"
ALERT_EMAIL="${ALERT_EMAIL:-admin@methna.com}"
MAX_BACKUP_AGE_HOURS=48  # Alert if no recent backup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to send alert email
send_alert() {
    local subject="$1"
    local message="$2"
    
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
        log "Alert email sent to $ALERT_EMAIL"
    else
        log "WARNING: mail command not found, cannot send alert"
    fi
}

# Function to verify backup file integrity
verify_backup_integrity() {
    local backup_file="$1"
    
    # Check if file exists
    if [[ ! -f "$backup_file" ]]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi
    
    # Check file size (should not be empty)
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
    if [[ "$file_size" -lt 1000 ]]; then  # Less than 1KB is suspicious
        log "ERROR: Backup file too small: $backup_file ($file_size bytes)"
        return 1
    fi
    
    # Verify checksum if exists
    local checksum_file="${backup_file}.sha256"
    if [[ -f "$checksum_file" ]]; then
        if sha256sum -c "$checksum_file" > /dev/null 2>&1; then
            log "✓ Checksum verified for $(basename "$backup_file")"
        else
            log "ERROR: Checksum verification failed for $(basename "$backup_file")"
            return 1
        fi
    else
        log "WARNING: No checksum file for $(basename "$backup_file")"
    fi
    
    # Test if backup can be read (basic structure check)
    if pg_restore --list "$backup_file" > /dev/null 2>&1; then
        log "✓ Backup structure verified for $(basename "$backup_file")"
        return 0
    else
        log "ERROR: Backup structure verification failed for $(basename "$backup_file")"
        return 1
    fi
}

# Function to check backup age
check_backup_age() {
    local env="$1"
    local latest_backup
    local age_hours
    
    # Find latest backup for environment
    latest_backup=$(ls -t "$BACKUP_DIR"/methna_${env}_*.sql 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log "ERROR: No backups found for $env environment"
        return 1
    fi
    
    # Calculate age in hours
    local backup_time=$(stat -f%m "$latest_backup" 2>/dev/null || stat -c%Y "$latest_backup" 2>/dev/null)
    local current_time=$(date +%s)
    age_hours=$(( (current_time - backup_time) / 3600 ))
    
    log "Latest $env backup: $(basename "$latest_backup") (${age_hours}h old)"
    
    if [[ "$age_hours" -gt "$MAX_BACKUP_AGE_HOURS" ]]; then
        log "WARNING: $env backup is older than ${MAX_BACKUP_AGE_HOURS} hours"
        return 1
    fi
    
    return 0
}

# Function to verify all backups
verify_all_backups() {
    local failed_count=0
    local total_count=0
    
    log "=== Starting Backup Verification ==="
    
    # Check both environments
    for env in dev prod; do
        log "Checking $env environment..."
        
        # Check backup age
        if ! check_backup_age "$env"; then
            ((failed_count++))
        fi
        
        # Verify latest backup integrity
        local latest_backup
        latest_backup=$(ls -t "$BACKUP_DIR"/methna_${env}_*.sql 2>/dev/null | head -1)
        if [[ -n "$latest_backup" ]]; then
            ((total_count++))
            if ! verify_backup_integrity "$latest_backup"; then
                ((failed_count++))
            fi
        fi
    done
    
    log "=== Verification Complete ==="
    log "Total backups checked: $total_count"
    log "Failed verifications: $failed_count"
    
    return "$failed_count"
}

# Function to check disk space
check_disk_space() {
    local backup_usage
    local available_space
    
    # Check backup directory usage
    backup_usage=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "Unknown")
    log "Backup directory usage: $backup_usage"
    
    # Check available space
    available_space=$(df -h "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "Unknown")
    log "Available disk space: $available_space"
    
    # Alert if less than 1GB available
    local available_kb=$(df -k "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    if [[ "$available_kb" -lt 1048576 ]]; then  # Less than 1GB
        log "WARNING: Low disk space ($available_space)"
        return 1
    fi
    
    return 0
}

# Main execution
main() {
    local failed_count=0
    local alert_message=""
    
    log "=== Backup Verification Started ==="
    
    # Check disk space
    if ! check_disk_space; then
        ((failed_count++))
        alert_message="${alert_message}Low disk space warning. "
    fi
    
    # Verify backups
    if ! verify_all_backups; then
        failed_count=$?
        alert_message="${alert_message}Backup verification failures detected. "
    fi
    
    # Send alert if issues found
    if [[ "$failed_count" -gt 0 ]]; then
        alert_message="Methna Backup Alert: $failed_count issues detected. $alert_message"
        alert_message="${alert_message}Check logs: $LOG_FILE"
        send_alert "Backup Verification Alert" "$alert_message"
        log "ALERT: $failed_count issues detected, alert sent"
        exit 1
    else
        log "✓ All backup verifications passed"
        exit 0
    fi
}

# Execute main function
main "$@"
