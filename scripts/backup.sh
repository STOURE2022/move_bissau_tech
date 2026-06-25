#!/bin/bash
# === MoveBissau — Sauvegarde quotidienne ===
# À planifier dans cron : 0 3 * * * /opt/movebissau/scripts/backup.sh
# Sauvegarde la base PostgreSQL et les fichiers MinIO

set -e

BACKUP_DIR="/opt/movebissau/backups"
DATE=$(date +%Y-%m-%d_%H%M)
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Début de la sauvegarde..."

# 1. Sauvegarde PostgreSQL
docker compose -f /opt/movebissau/docker-compose.yml exec -T db \
  pg_dump -U movebissau movebissau | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

echo "Base de données sauvegardée : db_$DATE.sql.gz"

# 2. Sauvegarde MinIO (documents chauffeurs, photos)
docker compose -f /opt/movebissau/docker-compose.yml exec -T minio \
  tar czf - /data 2>/dev/null > "$BACKUP_DIR/minio_$DATE.tar.gz" || true

echo "Fichiers MinIO sauvegardés : minio_$DATE.tar.gz"

# 3. Nettoyage des anciennes sauvegardes
find "$BACKUP_DIR" -type f -mtime +$KEEP_DAYS -delete

echo "[$(date)] Sauvegarde terminée. Anciennes sauvegardes > ${KEEP_DAYS}j supprimées."
