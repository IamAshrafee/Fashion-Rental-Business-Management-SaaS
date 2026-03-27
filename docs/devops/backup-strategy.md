# DevOps: Backup Strategy

## Overview

Automated backups for all critical data: PostgreSQL, MinIO, and Redis.

---

## Backup Schedule

| Data | Frequency | Retention | Method |
|---|---|---|---|
| PostgreSQL (full) | Daily 2 AM | 30 days | pg_dump |
| PostgreSQL (WAL) | Continuous | 7 days | WAL archiving |
| MinIO (images) | Weekly Sunday 3 AM | 90 days | rclone sync |
| Redis | Every 6 hours | 3 days | RDB snapshot |

---

## PostgreSQL Backup

### Daily Full Backup

```bash
#!/bin/bash
# /opt/closetrent/scripts/backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/postgres"
FILENAME="closetrent_${TIMESTAMP}.sql.gz"

docker compose exec -T postgres pg_dump \
  -U ${DB_USER} \
  -d closetrent \
  --format=custom \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

# Remove backups older than 30 days
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +30 -delete

# Upload to remote storage (optional)
rclone copy "${BACKUP_DIR}/${FILENAME}" remote:closetrent-backups/postgres/

echo "Backup completed: ${FILENAME}"
```

### CRON

```
0 2 * * * /opt/closetrent/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

---

## MinIO Backup

```bash
#!/bin/bash
# /opt/closetrent/scripts/backup-minio.sh

rclone sync \
  /opt/closetrent/minio_data \
  remote:closetrent-backups/minio/ \
  --transfers 4 \
  --checkers 8
```

---

## Restore Procedures

### PostgreSQL

```bash
# Restore from backup
gunzip -c closetrent_20260415.sql.gz | \
  docker compose exec -T postgres pg_restore \
  -U ${DB_USER} \
  -d closetrent \
  --clean --if-exists
```

### MinIO

```bash
rclone sync remote:closetrent-backups/minio/ /opt/closetrent/minio_data
```

---

## Disaster Recovery

| Scenario | RTO | RPO |
|---|---|---|
| Database corruption | 1 hour | 24 hours (last daily backup) |
| VPS failure | 4 hours | 24 hours |
| Accidental deletion | 30 min | 0 (WAL point-in-time recovery) |
| Complete data loss | 8 hours | 24 hours |

RTO = Recovery Time Objective. RPO = Recovery Point Objective.
