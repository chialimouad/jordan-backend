#!/bin/bash

# Methna App Backup System Setup Script
# Sets up automated database backups with proper permissions and cron jobs

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="/var/backups/methna"
LOG_DIR="/var/log"
WEB_USER="${WEB_USER:-www-data}"  # Adjust based on your web server user
DB_USER="${DB_USER:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_message "$RED" "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to create directories
create_directories() {
    print_message "$YELLOW" "Creating backup directories..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    
    # Set proper permissions
    chown -R "$DB_USER:$DB_USER" "$BACKUP_DIR"
    chmod 755 "$BACKUP_DIR"
    
    chown -R "$DB_USER:$DB_USER" "$LOG_DIR/methna_backup.log" 2>/dev/null || true
    chmod 644 "$LOG_DIR/methna_backup.log" 2>/dev/null || true
    
    print_message "$GREEN" "✓ Directories created and permissions set"
}

# Function to make scripts executable
make_scripts_executable() {
    print_message "$YELLOW" "Making backup scripts executable..."
    
    chmod +x "$SCRIPT_DIR/backup_db.sh"
    chmod +x "$SCRIPT_DIR/restore_db.sh"
    chmod +x "$SCRIPT_DIR/verify_backups.sh" 2>/dev/null || true
    chmod +x "$SCRIPT_DIR/cleanup_old_backups.sh" 2>/dev/null || true
    
    print_message "$GREEN" "✓ Scripts are now executable"
}

# Function to setup cron jobs
setup_cron() {
    print_message "$YELLOW" "Setting up cron jobs..."
    
    # Create temporary cron file
    local temp_cron="/tmp/methna_cron_temp"
    
    # Get existing crontab
    crontab -l > "$temp_cron" 2>/dev/null || true
    
    # Remove old methna entries (if any)
    sed -i '/methna_backup/d' "$temp_cron" 2>/dev/null || true
    
    # Add new cron entries
    cat >> "$temp_cron" << EOF

# Methna App Database Backups
0 2 * * * $SCRIPT_DIR/backup_db.sh prod >> /var/log/methna_backup.log 2>&1
0 */6 * * * $SCRIPT_DIR/backup_db.sh dev >> /var/log/methna_backup.log 2>&1
EOF
    
    # Install new crontab
    crontab "$temp_cron"
    rm "$temp_cron"
    
    print_message "$GREEN" "✓ Cron jobs installed"
}

# Function to create environment file
create_env_file() {
    print_message "$YELLOW" "Creating environment configuration file..."
    
    local env_file="$SCRIPT_DIR/.env"
    
    cat > "$env_file" << EOF
# Methna App Database Backup Configuration
# Adjust these values according to your setup

# Database Connection
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here

# Database Names
DB_NAME_DEV=methna_dev
DB_NAME_PROD=methna_prod

# Backup Settings
BACKUP_DIR=$BACKUP_DIR
RETENTION_DAYS=14
LOG_FILE=/var/log/methna_backup.log
EOF
    
    # Set secure permissions
    chmod 600 "$env_file"
    chown "$DB_USER:$DB_USER" "$env_file" 2>/dev/null || true
    
    print_message "$GREEN" "✓ Environment file created at $env_file"
    print_message "$YELLOW" "⚠  Please edit $env_file with your actual database credentials"
}

# Function to test backup
test_backup() {
    print_message "$YELLOW" "Testing backup creation..."
    
    # Source environment file if it exists
    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        source "$SCRIPT_DIR/.env"
    fi
    
    # Test with dev environment
    if "$SCRIPT_DIR/backup_db.sh" dev; then
        print_message "$GREEN" "✓ Backup test successful"
        
        # List created backups
        print_message "$YELLOW" "Available backups:"
        ls -la "$BACKUP_DIR"/methna_dev_*.sql 2>/dev/null || print_message "$YELLOW" "No dev backups found"
    else
        print_message "$RED" "✗ Backup test failed"
        return 1
    fi
}

# Function to show next steps
show_next_steps() {
    print_message "$GREEN" "\n=== Setup Complete! ==="
    echo
    print_message "$YELLOW" "Next steps:"
    echo "1. Edit $SCRIPT_DIR/.env with your database credentials"
    echo "2. Test manual backup: $SCRIPT_DIR/backup_db.sh prod"
    echo "3. Test restore: $SCRIPT_DIR/restore_db.sh <backup_file>"
    echo "4. Monitor logs: tail -f /var/log/methna_backup.log"
    echo "5. Check cron jobs: crontab -l"
    echo
    print_message "$YELLOW" "Backup directory: $BACKUP_DIR"
    print_message "$YELLOW" "Log file: /var/log/methna_backup.log"
    echo
    print_message "$GREEN" "Automated backups are now configured!"
}

# Main execution
main() {
    print_message "$GREEN" "=== Methna App Backup System Setup ==="
    echo
    
    check_root
    create_directories
    make_scripts_executable
    setup_cron
    create_env_file
    
    # Only test backup if user confirms
    read -p "Do you want to test the backup now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        test_backup
    fi
    
    show_next_steps
}

# Run main function
main "$@"
