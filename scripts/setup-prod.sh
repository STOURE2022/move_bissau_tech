#!/bin/bash
# ============================================================
# MoveBissau — Setup production sur la VM GCP
# À exécuter UNE FOIS après le clone du repo sur la VM
# ============================================================
set -euo pipefail

echo "============================================"
echo "  MoveBissau — Setup Production"
echo "============================================"

cd /opt/movebissau

# === 1. Vérifier que .env existe ===
if [ ! -f backend/.env ]; then
  echo "ERREUR: backend/.env n'existe pas !"
  echo "Créez-le d'abord : cp backend/.env.example backend/.env && nano backend/.env"
  exit 1
fi

# === 2. Builder les frontends ===
echo "[1/5] Build du frontend passager..."
cd frontend
npm install --production=false
npm run build
cd ..

echo "[2/5] Build du dashboard admin..."
cd admin
npm install --production=false
npm run build
cd ..

# === 3. Copier les builds dans le dossier nginx ===
echo "[3/5] Préparation des fichiers statiques..."
mkdir -p nginx/frontend nginx/admin
cp -r frontend/dist/* nginx/frontend/
cp -r admin/dist/* nginx/admin/

# === 4. Lancer les services ===
echo "[4/5] Démarrage des services Docker..."
docker compose -f docker-compose.yml up -d --build

# === 5. Appliquer les migrations ===
echo "[5/5] Migrations de la base de données..."
sleep 10  # Attendre que la DB soit prête
docker compose exec api python manage.py migrate --noinput

# Créer le superuser si pas encore fait
docker compose exec api python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser(phone='+245955000001', password='Admin2026!')
    print('Superuser créé : +245955000001 / Admin2026!')
else:
    print('Superuser existe déjà')
" 2>/dev/null || true

# Seed les configs par défaut
docker compose exec api python manage.py shell -c "
from apps.admin_dashboard.models import SystemConfig
CONFIGS = [
    ('country_code', 'gw', 'Code pays ISO', 'location'),
    ('country_name', 'Guinée-Bissau', 'Nom du pays', 'location'),
    ('country_flag', '🇬🇼', 'Drapeau emoji', 'location'),
    ('phone_prefix', '+245', 'Indicatif téléphonique', 'location'),
    ('default_lat', 11.8636, 'Latitude centre carte', 'location'),
    ('default_lng', -15.5977, 'Longitude centre carte', 'location'),
    ('default_zoom', 15, 'Zoom carte', 'location'),
    ('currency', 'XOF', 'Code devise', 'location'),
    ('currency_symbol', 'F CFA', 'Symbole devise', 'location'),
    ('commission_rate', 15.0, 'Taux commission (%)', 'commission'),
    ('min_credit_for_rides', 200, 'Crédit min pour courses (XOF)', 'commission'),
    ('cancellation_fee', 500, 'Frais annulation (XOF)', 'cancellation'),
    ('base_price_moto', 200, 'Prix base moto (XOF)', 'pricing'),
    ('base_price_car', 500, 'Prix base voiture (XOF)', 'pricing'),
    ('price_per_km_moto', 150, 'Prix/km moto (XOF)', 'pricing'),
    ('price_per_km_car', 300, 'Prix/km voiture (XOF)', 'pricing'),
]
for key, val, desc, cat in CONFIGS:
    SystemConfig.objects.get_or_create(key=key, defaults={'value': val, 'description': desc, 'category': cat})
print('Configs initialisées')
" 2>/dev/null || true

echo ""
echo "============================================"
echo "  Déploiement terminé !"
echo "============================================"
echo ""
echo "Services en cours :"
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Prochaine étape : configurez SSL avec ./scripts/setup-ssl.sh"
