"""Settings local pour Windows (sans GDAL/PostGIS)."""
from .dev import *  # noqa: F401,F403

# Utiliser PostgreSQL standard au lieu de PostGIS
# Les champs géo (PointField, etc.) fonctionnent toujours via psycopg
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='movebissau'),
        'USER': config('DB_USER', default='movebissau'),
        'PASSWORD': config('DB_PASSWORD', default='movebissau'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# Désactiver GeoDjango qui nécessite GDAL
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'django.contrib.gis']

# Channel layer en mémoire (pas besoin de Redis en local)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}
