#!/bin/bash
# === MoveBissau — Script de déploiement initial ===
# Usage : ssh root@serveur 'bash -s' < scripts/deploy-init.sh
# Prérequis : VPS Ubuntu 22.04+ avec accès root

set -e

echo "=== MoveBissau — Initialisation du serveur ==="

# 1. Mise à jour système
apt-get update && apt-get upgrade -y

# 2. Installer Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 3. Installer Docker Compose
apt-get install -y docker-compose-plugin

# 4. Créer le répertoire de l'application
mkdir -p /opt/movebissau
cd /opt/movebissau

# 5. Créer le fichier .env
cat > .env << 'ENVEOF'
# === MoveBissau Production ===
SECRET_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
DB_PASSWORD=$(openssl rand -hex 16)
MINIO_USER=minioadmin
MINIO_PASSWORD=$(openssl rand -hex 16)
ALLOWED_HOSTS=api.movebissau.com
CORS_ALLOWED_ORIGINS=https://admin.movebissau.com
ENVEOF

echo "Fichier .env créé. ÉDITEZ-LE pour vérifier les valeurs."

# 6. Installer Certbot pour SSL
apt-get install -y certbot
echo "Pour obtenir le certificat SSL :"
echo "  certbot certonly --standalone -d api.movebissau.com -d admin.movebissau.com"
echo "  mkdir -p /opt/movebissau/nginx/ssl"
echo "  cp /etc/letsencrypt/live/api.movebissau.com/fullchain.pem /opt/movebissau/nginx/ssl/"
echo "  cp /etc/letsencrypt/live/api.movebissau.com/privkey.pem /opt/movebissau/nginx/ssl/"

# 7. Configurer le firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo ""
echo "=== Initialisation terminée ==="
echo ""
echo "Étapes suivantes :"
echo "  1. Éditez /opt/movebissau/.env"
echo "  2. Configurez le DNS (api.movebissau.com + admin.movebissau.com)"
echo "  3. Obtenez le certificat SSL avec certbot"
echo "  4. Copiez le code : rsync -avz . root@serveur:/opt/movebissau/"
echo "  5. Lancez : cd /opt/movebissau && docker compose up -d"
echo "  6. Initialisez la BDD : docker compose exec api python manage.py migrate"
echo "  7. Initialisez la config : docker compose exec api python manage.py init_config"
echo "  8. Créez l'admin : docker compose exec api python manage.py createsuperuser"
