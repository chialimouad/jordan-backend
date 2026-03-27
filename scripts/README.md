# Methna App Database Backup System

Automated PostgreSQL backup and restore solution for the Methna dating app.

## Overview

This backup system provides:
- **Automated daily backups** via cron jobs
- **Compressed backups** with integrity verification
- **Retention policy** (keep last 14 days by default)
- **Easy restore** with pre-restore safety backup
- **Email alerts** for backup failures
- **Environment separation** (dev/prod)

## Quick Setup

```bash
# 1. Make setup script executable
chmod +x setup_backups.sh

# 2. Run setup (requires sudo)
sudo ./setup_backups.sh

# 3. Edit configuration
nano .env

# 4. Test backup
./backup_db.sh prod

# 5. Verify cron jobs
crontab -l
```

## Files

| File | Purpose |
|------|---------|
| `backup_db.sh` | Creates compressed database backups |
| `restore_db.sh` | Restores database from backup |
| `setup_backups.sh` | Initial setup and configuration |
| `verify_backups.sh` | Weekly backup verification |
| `methna_backup_cron` | Cron job configuration |
| `.env` | Database credentials (created by setup) |

## Configuration

Edit `.env` file with your database settings:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME_DEV=methna_dev
DB_NAME_PROD=methna_prod
BACKUP_DIR=/var/backups/methna
RETENTION_DAYS=14
```

## Usage

### Manual Backup

```bash
# Production backup
./backup_db.sh prod

# Development backup
./backup_db.sh dev
```

### Manual Restore

```bash
# List available backups
ls -la /var/backups/methna/methna_prod_*.sql

# Restore from backup
./restore_db.sh /var/backups/methna/methna_prod_20260327_120000.sql prod
```

### Verify Backups

```bash
# Run verification
./verify_backups.sh

# Check logs
tail -f /var/log/methna_backup.log
```

## Automated Schedule

The system configures these cron jobs:

- **Daily 2:00 AM**: Production backup
- **Every 6 hours**: Development backup
- **Weekly Sunday 3:00 AM**: Backup verification
- **Monthly 1st**: Cleanup old backups

## Backup Locations

- **Backup files**: `/var/backups/methna/`
- **Log file**: `/var/log/methna_backup.log`
- **Checksums**: `.sha256` files alongside backups

## Backup Format

Backups are created using `pg_dump` with these options:
- **Format**: Custom compressed format
- **Compression**: Level 9 (maximum)
- **Options**: `--clean --if-exists --no-owner --no-privileges`
- **Integrity**: SHA256 checksum verification

## Restore Process

1. **Pre-restore backup**: Automatically creates backup before restore
2. **Database drop**: Drops existing database cleanly
3. **Database recreation**: Creates fresh database
4. **Data restore**: Restores from backup file
5. **Verification**: Confirms restore success

## Monitoring

### Check Backup Status

```bash
# View recent backups
ls -la /var/backups/methna/ | tail -10

# Check backup sizes
du -sh /var/backups/methna/methna_prod_*.sql

# Monitor logs
tail -f /var/log/methna_backup.log
```

### Email Alerts

Configure alert email in `verify_backups.sh`:
```bash
ALERT_EMAIL=admin@methna.com
```

Alerts sent for:
- Backup verification failures
- Disk space warnings
- Missing recent backups

## Troubleshooting

### Permission Issues

```bash
# Fix backup directory permissions
sudo chown -R postgres:postgres /var/backups/methna
sudo chmod 755 /var/backups/methna

# Fix log file permissions
sudo chown postgres:postgres /var/log/methna_backup.log
sudo chmod 644 /var/log/methna_backup.log
```

### Connection Issues

1. Verify PostgreSQL is running
2. Check database credentials in `.env`
3. Test connection manually:
```bash
psql -h localhost -U postgres -d methna_prod
```

### Backup Verification Fails

1. Check backup file integrity:
```bash
sha256sum -c backup_file.sql.sha256
```

2. Test backup structure:
```bash
pg_restore --list backup_file.sql
```

### Cron Issues

1. Check cron service:
```bash
sudo systemctl status cron
```

2. View cron logs:
```bash
sudo grep CRON /var/log/syslog
```

## Security Considerations

- **Environment file**: `.env` contains sensitive passwords (600 permissions)
- **Backup encryption**: Consider encrypting backups for production
- **Access control**: Limit backup file access to database user
- **Network security**: Use SSL connections for remote databases

## Performance Impact

- **Backup time**: Typically 1-5 minutes for 1GB database
- **Storage**: Compressed backups ~10-30% of database size
- **CPU impact**: Minimal during off-peak hours (2:00 AM)

## Disaster Recovery

### Full System Recovery

1. **Reinstall PostgreSQL**
2. **Create database**: `createdb methna_prod`
3. **Restore backup**: `./restore_db.sh <backup_file> prod`
4. **Verify application**: Test Methna app functionality

### Point-in-Time Recovery

For point-in-time recovery, enable WAL archiving in PostgreSQL:
```sql
-- postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/backups/methna/wal/%f'
```

## Maintenance

### Monthly Tasks

- Review backup retention policy
- Check disk space usage
- Test restore process
- Update documentation

### Quarterly Tasks

- Review security settings
- Update backup scripts
- Test disaster recovery procedure
- Performance tuning

## Support

For issues or questions:
1. Check logs: `/var/log/methna_backup.log`
2. Verify configuration: `.env` file
3. Test manual backup/restore
4. Review this documentation

---

**Last Updated**: March 27, 2026  
**Version**: 1.0.0  
**Compatible**: PostgreSQL 12+, Ubuntu 20.04+
