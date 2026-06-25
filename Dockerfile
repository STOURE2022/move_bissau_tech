# Dockerfile pour Railway — backend Django MoveBissau
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin libgdal-dev libgeos-dev libproj-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements/base.txt requirements/base.txt
COPY backend/requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

COPY backend/ .

ENV DJANGO_SETTINGS_MODULE=config.settings.railway
ENV PORT=8000

RUN SECRET_KEY=build-temp-key python manage.py collectstatic --noinput 2>/dev/null || true

CMD ["python", "start.py"]
