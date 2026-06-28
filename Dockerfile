# Dockerfile pour Railway — backend Django + frontend React MoveBissau

# === Étape 1 : Build du frontend React ===
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY frontend/ .
RUN npm run build

# === Étape 2 : Backend Django + fichiers frontend ===
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev libgeos-dev libproj-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements/base.txt requirements/base.txt
COPY backend/requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

COPY backend/ .

# Copier le build frontend dans le dossier static de Django
COPY --from=frontend-build /frontend/dist /app/frontend_dist

ENV DJANGO_SETTINGS_MODULE=config.settings.railway
ENV PYTHONUNBUFFERED=1

RUN SECRET_KEY=build-temp-key python manage.py collectstatic --noinput || echo "WARNING: collectstatic failed"

CMD ["python", "start.py"]
