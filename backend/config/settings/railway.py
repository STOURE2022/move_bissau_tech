"""Settings pour déploiement Railway."""
import os
from .base import *  # noqa: F401,F403

DEBUG = False

# === Base de données ===
# Railway injecte DATABASE_URL ou les variables PG* individuelles
DATABASE_URL = os.environ.get('DATABASE_URL', os.environ.get('DATABASE_PRIVATE_URL', ''))

if DATABASE_URL:
    import dj_database_url
    DATABASES['default'] = dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,
        engine='django.contrib.gis.db.backends.postgis',
    )
else:
    # Fallback sur les variables Railway individuelles
    PGHOST = os.environ.get('PGHOST', os.environ.get('DB_HOST', 'localhost'))
    DATABASES['default'] = {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': os.environ.get('PGDATABASE', os.environ.get('DB_NAME', 'movebissau')),
        'USER': os.environ.get('PGUSER', os.environ.get('DB_USER', 'movebissau')),
        'PASSWORD': os.environ.get('PGPASSWORD', os.environ.get('DB_PASSWORD', '')),
        'HOST': PGHOST,
        'PORT': os.environ.get('PGPORT', os.environ.get('DB_PORT', '5432')),
    }

# === Redis ===
REDIS_URL = os.environ.get('REDIS_URL', os.environ.get('REDIS_PRIVATE_URL', ''))

if REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {'hosts': [REDIS_URL]},
        },
    }
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)
else:
    # Fallback sans Redis (fonctionnalités temps réel désactivées)
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
    CELERY_BROKER_URL = ''
    CELERY_RESULT_BACKEND = ''

# === Sécurité ===
SECURE_SSL_REDIRECT = False  # Railway gère le SSL
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# === Hosts ===
ALLOWED_HOSTS = ['*']  # Railway gère le routing
CORS_ALLOW_ALL_ORIGINS = True  # À restreindre plus tard avec les vrais domaines

# === Sentry ===
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    sentry_sdk.init(dsn=SENTRY_DSN, integrations=[DjangoIntegration()])

# === Logs ===
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
}

# Debug: afficher la config DB au démarrage
import logging
_logger = logging.getLogger(__name__)
_db = DATABASES['default']
_logger.info(f"DB config: engine={_db.get('ENGINE')} host={_db.get('HOST', 'via URL')} name={_db.get('NAME', 'via URL')}")
_logger.info(f"Redis: {REDIS_URL[:30]}...")
