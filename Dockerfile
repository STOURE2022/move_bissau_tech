# Dockerfile racine pour Railway — build le backend Django
FROM python:3.12-slim

# Dépendances système pour PostGIS et GDAL
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer les dépendances Python
COPY backend/requirements/base.txt requirements/base.txt
COPY backend/requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

# Copier le code backend
COPY backend/ .

# Variables d'environnement par défaut pour le build
ENV DJANGO_SETTINGS_MODULE=config.settings.railway
ENV SECRET_KEY=build-only-secret-key

# Collecter les fichiers statiques
RUN python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
