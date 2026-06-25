#!/bin/bash
# ============================================================
# MoveBissau — Déploiement sur Google Cloud Platform (GCE)
# ============================================================
#
# Prérequis :
#   1. gcloud CLI installé et configuré (gcloud auth login)
#   2. Un projet GCP créé (gcloud config set project MON_PROJET)
#   3. Billing activé sur le projet
#
# Usage :
#   chmod +x scripts/gcp-deploy.sh
#   ./scripts/gcp-deploy.sh
#
# Ce script :
#   1. Crée une VM e2-medium (2 vCPU, 4 GB RAM) — ~$25/mois
#   2. Installe Docker + Docker Compose
#   3. Clone le repo et lance les services
#   4. Configure le firewall (HTTP/HTTPS/WebSocket)
#   5. Affiche l'IP publique pour configurer le DNS
# ============================================================

set -euo pipefail

# === CONFIGURATION ===
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
ZONE="europe-west1-b"          # Belgique (proche de l'Afrique de l'Ouest)
MACHINE_TYPE="e2-medium"       # 2 vCPU, 4 GB RAM — $25/mois
INSTANCE_NAME="movebissau-prod"
IMAGE_FAMILY="ubuntu-2404-lts-amd64"
IMAGE_PROJECT="ubuntu-os-cloud"
DISK_SIZE="30"                 # Go

echo "============================================"
echo "  MoveBissau — Déploiement GCP"
echo "============================================"
echo "Projet : $PROJECT_ID"
echo "Zone   : $ZONE"
echo "VM     : $INSTANCE_NAME ($MACHINE_TYPE)"
echo ""

# === 1. Activer les APIs nécessaires ===
echo "[1/6] Activation des APIs GCP..."
gcloud services enable compute.googleapis.com --quiet

# === 2. Créer les règles de firewall ===
echo "[2/6] Configuration du firewall..."
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 --target-tags=http-server \
  --description="HTTP" --quiet 2>/dev/null || true

gcloud compute firewall-rules create allow-https \
  --allow tcp:443 --target-tags=https-server \
  --description="HTTPS" --quiet 2>/dev/null || true

# === 3. Créer la VM ===
echo "[3/6] Création de la VM..."
gcloud compute instances create $INSTANCE_NAME \
  --zone=$ZONE \
  --machine-type=$MACHINE_TYPE \
  --image-family=$IMAGE_FAMILY \
  --image-project=$IMAGE_PROJECT \
  --boot-disk-size=${DISK_SIZE}GB \
  --boot-disk-type=pd-ssd \
  --tags=http-server,https-server \
  --metadata=startup-script='#!/bin/bash
    # Installer Docker
    curl -fsSL https://get.docker.com | bash
    usermod -aG docker $USER

    # Installer Docker Compose
    apt-get install -y docker-compose-plugin

    # Créer le répertoire de l'app
    mkdir -p /opt/movebissau
    chown -R 1000:1000 /opt/movebissau
  '

echo "Attente du démarrage de la VM..."
sleep 30

# === 4. Récupérer l'IP publique ===
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME \
  --zone=$ZONE \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "============================================"
echo "  VM créée avec succès !"
echo "============================================"
echo ""
echo "IP publique : $EXTERNAL_IP"
echo ""
echo "=== Prochaines étapes ==="
echo ""
echo "1. Connectez-vous à la VM :"
echo "   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo ""
echo "2. Sur la VM, clonez le repo :"
echo "   cd /opt/movebissau"
echo "   git clone https://github.com/VOTRE_USER/MoveBissau.git ."
echo ""
echo "3. Créez le fichier .env de production :"
echo "   cp backend/.env.example backend/.env"
echo "   nano backend/.env  # Éditez les valeurs"
echo ""
echo "4. Lancez le déploiement :"
echo "   chmod +x scripts/setup-prod.sh"
echo "   ./scripts/setup-prod.sh"
echo ""
echo "5. Configurez votre DNS :"
echo "   api.movebissau.com    → A $EXTERNAL_IP"
echo "   admin.movebissau.com  → A $EXTERNAL_IP"
echo "   app.movebissau.com    → A $EXTERNAL_IP"
echo ""
echo "6. Activez SSL (sur la VM) :"
echo "   ./scripts/setup-ssl.sh"
echo ""
