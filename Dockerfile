# Dockerfile pour Railway — backend Django MoveBissau
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev libgeos-dev libproj-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements/base.txt requirements/base.txt
COPY backend/requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

# Cache buster — change this to force rebuild
ARG CACHEBUST=7
COPY backend/ .

ENV DJANGO_SETTINGS_MODULE=config.settings.railway

RUN SECRET_KEY=build-temp-key python manage.py collectstatic --noinput 2>/dev/null || true

# Le startCommand de railway.toml remplace ce CMD en production
CMD python manage.py migrate --noinput 2>&1 && echo "Starting daphne on port $PORT..." && daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application 2>&1
