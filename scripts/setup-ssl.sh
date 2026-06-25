#!/bin/bash
# ============================================================
# MoveBissau — Setup SSL avec Let's Encrypt (Certbot)
# ============================================================
set -euo pipefail

# Domaines à configurer
API_DOMAIN="${API_DOMAIN:-api.movebissau.com}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.movebissau.com}"
APP_DOMAIN="${APP_DOMAIN:-app.movebissau.com}"
EMAIL="${SSL_EMAIL:-admin@movebissau.com}"

echo "============================================"
echo "  SSL Setup — Let's Encrypt"
echo "============================================"
echo "Domaines : $API_DOMAIN, $ADMIN_DOMAIN, $APP_DOMAIN"
echo "Email    : $EMAIL"
echo ""

# Installer Certbot
sudo apt-get update -qq
sudo apt-get install -y certbot

# Stopper nginx temporairement pour le challenge HTTP
docker compose stop nginx 2>/dev/null || true

# Obtenir les certificats
sudo certbot certonly --standalone \
  -d "$API_DOMAIN" \
  -d "$ADMIN_DOMAIN" \
  -d "$APP_DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL"

# Copier les certificats dans le dossier nginx
CERT_DIR="/etc/letsencrypt/live/$API_DOMAIN"
mkdir -p nginx/ssl
sudo cp "$CERT_DIR/fullchain.pem" nginx/ssl/
sudo cp "$CERT_DIR/privkey.pem" nginx/ssl/
sudo chmod 644 nginx/ssl/*.pem

# Redémarrer nginx
docker compose up -d nginx

# Configurer le renouvellement automatique
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'cp /etc/letsencrypt/live/$API_DOMAIN/*.pem /opt/movebissau/nginx/ssl/ && docker compose -f /opt/movebissau/docker-compose.yml restart nginx'") | crontab -

echo ""
echo "✅ SSL configuré avec succès !"
echo "Renouvellement automatique planifié (tous les jours à 3h)"
