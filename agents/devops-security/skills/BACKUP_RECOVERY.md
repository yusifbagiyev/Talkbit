# Skill: Backup & Recovery

## Purpose

Verilənlər bazası, fayllar və konfiqurasiyaların backup-ını almaq, restore prosesini test etmək, disaster recovery planı hazırlamaq.

## Scope

- PostgreSQL database backup (pg_dump)
- File storage backup (uploads)
- Configuration backup (.env, nginx.conf, docker-compose.yml)
- Automated backup scheduling
- Restore testing
- Disaster recovery plan

## Process

### 1. PostgreSQL Backup

```bash
# Manual full backup
docker exec talkbit_postgres pg_dump -U $DB_USER -d $DB_NAME -F c -f /tmp/backup.dump
docker cp talkbit_postgres:/tmp/backup.dump ./backups/db-$(date +%Y%m%d-%H%M).dump

# Automated daily backup (cron)
0 3 * * * /opt/talkbit/scripts/backup-db.sh

# Backup script
#!/bin/bash
BACKUP_DIR=/opt/talkbit/backups/db
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M)

docker exec talkbit_postgres pg_dump -U talkbit_user -d talkbit -F c -f /tmp/backup.dump
docker cp talkbit_postgres:/tmp/backup.dump $BACKUP_DIR/db-$TIMESTAMP.dump
docker exec talkbit_postgres rm /tmp/backup.dump

# Köhnə backup-ları sil
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
echo "$(date): DB backup completed: db-$TIMESTAMP.dump" >> /var/log/talkbit-backup.log
```

### 2. File Storage Backup

```bash
# Upload faylları backup et
BACKUP_DIR=/opt/talkbit/backups/uploads
TIMESTAMP=$(date +%Y%m%d-%H%M)

# Docker volume-dan kopyala
docker cp talkbit_backend:/app/uploads $BACKUP_DIR/uploads-$TIMESTAMP/

# Incremental backup (rsync)
rsync -a --delete /var/lib/docker/volumes/talkbit_uploads_data/_data/ $BACKUP_DIR/uploads-latest/
```

### 3. Configuration Backup

```bash
# Critical fayllar
cp .env backups/config/env-$(date +%Y%m%d)
cp docker-compose.yml backups/config/
cp nginx/nginx.conf backups/config/
cp monitoring/*.yml backups/config/
```

### 4. Restore Procedures

**Database Restore:**
```bash
# WARNING: Mövcud database-i silir!
docker cp backup.dump talkbit_postgres:/tmp/backup.dump
docker exec talkbit_postgres pg_restore -U talkbit_user -d talkbit --clean --if-exists -F c /tmp/backup.dump
docker compose restart backend
```

**File Storage Restore:**
```bash
docker cp uploads-backup/ talkbit_backend:/app/uploads/
```

**Full Disaster Recovery:**
```bash
# 1. Yeni server-ə Docker quraşdır
# 2. Repo clone et
git clone https://github.com/OWNER/REPO.git
cd REPO

# 3. .env faylını bərpa et (backup-dan)
cp backups/config/env-latest .env

# 4. Stack-i qaldır
docker compose up -d

# 5. Database restore et
# (backup faylını serverə köçür, yuxarıdakı restore əmrlərini çalışdır)

# 6. Upload fayllarını bərpa et
# 7. SSL certificate al (certbot)
# 8. DNS yenilə (Cloudflare)
# 9. Health check
```

### 5. Backup Testing (Aylıq)

- [ ] Database backup-ı götür
- [ ] Ayrı container-da restore et
- [ ] Əsas sorğuları test et (SELECT count)
- [ ] File backup-ı yoxla (random fayl aç)
- [ ] Restore vaxtını ölç (MTTR hesabla)
- [ ] Nəticəni journal-a yaz

## Quality Bar

- Günlük avtomatik DB backup
- 30 gün retention
- Aylıq restore test mütləqdir
- Backup success/failure log olunmalıdır
- Backup faylları server-dən kənarda da saxlanmalıdır (off-site)
- DR plan test olunmalıdır (ildə 1 dəfə)
