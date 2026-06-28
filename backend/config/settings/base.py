"""
Settings de base pour MoveBissau.
Paramètres communs à tous les environnements.
"""
import os
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

# === Chemins ===
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# === Sécurité ===
SECRET_KEY = config('SECRET_KEY', default='changez-moi-en-production')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# === Applications ===
DJANGO_APPS = [
    'jazzmin',  # Doit être avant django.contrib.admin
    'daphne',  # Doit être avant django.contrib.staticfiles
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',  # GeoDjango (PostGIS)
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'channels',
    'django_celery_beat',
    'storages',
]

LOCAL_APPS = [
    'apps.accounts',
    'apps.drivers',
    'apps.rides',
    'apps.payments',
    'apps.commissions',
    'apps.ratings',
    'apps.incidents',
    'apps.notifications',
    'apps.admin_dashboard',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# === Middleware ===
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'core.middleware.LanguageMiddleware',  # Langue basée sur le profil utilisateur
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# === Base de données (PostgreSQL + PostGIS) ===
# Support DATABASE_URL (Railway, Heroku) ou variables individuelles
_DATABASE_URL = os.environ.get('DATABASE_URL', os.environ.get('DATABASE_PRIVATE_URL', ''))
if _DATABASE_URL:
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.config(
            default=_DATABASE_URL,
            conn_max_age=600,
            engine='django.contrib.gis.db.backends.postgis',
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': os.environ.get('PGDATABASE', config('DB_NAME', default='movebissau')),
            'USER': os.environ.get('PGUSER', config('DB_USER', default='movebissau')),
            'PASSWORD': os.environ.get('PGPASSWORD', config('DB_PASSWORD', default='movebissau')),
            'HOST': os.environ.get('PGHOST', config('DB_HOST', default='localhost')),
            'PORT': os.environ.get('PGPORT', config('DB_PORT', default='5432')),
            'OPTIONS': {
                'connect_timeout': 10,
            },
        }
    }

# === Modèle utilisateur personnalisé ===
AUTH_USER_MODEL = 'accounts.User'

# === Validation mot de passe (non utilisé, on utilise OTP) ===
AUTH_PASSWORD_VALIDATORS = []

# === Internationalisation ===
LANGUAGE_CODE = 'fr'
TIME_ZONE = 'Africa/Bissau'  # GMT+0
USE_I18N = True
USE_TZ = True

# Langues supportées
LANGUAGES = [
    ('fr', 'Français'),
    ('pt', 'Português'),
    ('gcr', 'Kriol'),  # Créole bissau-guinéen
]

# === Fichiers statiques ===
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# === Fichiers média ===
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# === Clé primaire par défaut ===
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# === Django REST Framework ===
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/minute',
        'user': '100/minute',
        'otp': '3/hour',  # Limite OTP par IP
    },
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DATETIME_FORMAT': '%Y-%m-%dT%H:%M:%S%z',
}

# === JWT ===
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'TOKEN_OBTAIN_SERIALIZER': 'apps.accounts.api.serializers.OTPTokenObtainSerializer',
}

# === Channels (WebSocket) ===
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(config('REDIS_HOST', default='localhost'),
                       config('REDIS_PORT', default=6379, cast=int))],
        },
    },
}

# === Celery ===
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/1')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://localhost:6379/2')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Africa/Bissau'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# === Redis (cache) ===
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://localhost:6379/0'),
    }
}

# === CORS ===
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://localhost:5173',
    cast=Csv()
)

# === Stockage fichiers (MinIO / S3) ===
USE_S3 = config('USE_S3', default=False, cast=bool)
if USE_S3:
    AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME', default='movebissau')
    AWS_S3_ENDPOINT_URL = config('AWS_S3_ENDPOINT_URL', default=None)  # MinIO endpoint
    AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='eu-central-1')
    AWS_DEFAULT_ACL = 'private'
    AWS_S3_FILE_OVERWRITE = False
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

# === Clé de chiffrement pour les secrets (clés API providers) ===
ENCRYPTION_KEY = config('ENCRYPTION_KEY', default='changez-moi-en-production')

# === OTP ===
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5
OTP_MAX_ATTEMPTS = 3

# === Configuration métier par défaut ===
# Ces valeurs sont surchargées par la table system_config (admin dashboard)
DEFAULT_COMMISSION_RATE = 15.0
DEFAULT_CANCELLATION_FEE = 500  # XOF
DEFAULT_SEARCH_RADIUS_M = 3000
MAX_SEARCH_RADIUS_M = 10000
MAX_DRIVERS_NOTIFIED = 10
RIDE_REQUEST_TTL_SECONDS = 300  # 5 minutes
RIDE_OFFER_TTL_SECONDS = 120  # 2 minutes

# === Jazzmin Admin UI ===
JAZZMIN_SETTINGS = {
    'site_title': 'MoveBissau Admin',
    'site_header': 'MoveBissau',
    'site_brand': 'MoveBissau',
    'welcome_sign': 'Bienvenue sur MoveBissau Admin',
    'copyright': 'MoveBissau Technologies',

    # Icônes Font Awesome pour chaque app/modèle
    'icons': {
        'auth': 'fas fa-users-cog',
        'auth.Group': 'fas fa-users',
        'accounts.User': 'fas fa-user',
        'accounts.OTPCode': 'fas fa-key',
        'drivers.Driver': 'fas fa-id-card',
        'drivers.DriverDocument': 'fas fa-file-alt',
        'drivers.Vehicle': 'fas fa-motorcycle',
        'rides.RideRequest': 'fas fa-hand-paper',
        'rides.RideOffer': 'fas fa-comments-dollar',
        'rides.Ride': 'fas fa-route',
        'payments.PaymentProvider': 'fas fa-plug',
        'payments.Payment': 'fas fa-money-bill-wave',
        'payments.Refund': 'fas fa-undo',
        'commissions.CommissionCredit': 'fas fa-wallet',
        'commissions.CreditTransaction': 'fas fa-exchange-alt',
        'commissions.Withdrawal': 'fas fa-cash-register',
        'ratings.Rating': 'fas fa-star',
        'incidents.Incident': 'fas fa-exclamation-triangle',
        'notifications.Notification': 'fas fa-bell',
        'admin_dashboard.SystemConfig': 'fas fa-cogs',
        'admin_dashboard.SmsProvider': 'fas fa-sms',
        'django_celery_beat.PeriodicTask': 'fas fa-clock',
    },
    'default_icon_parents': 'fas fa-folder',
    'default_icon_children': 'fas fa-circle',

    # Menu latéral
    'order_with_respect_to': [
        'accounts', 'drivers', 'rides', 'payments',
        'commissions', 'ratings', 'incidents', 'notifications',
        'admin_dashboard', 'django_celery_beat', 'auth',
    ],

    # UI
    'show_sidebar': True,
    'navigation_expanded': False,
    'hide_apps': [],
    'hide_models': [],
    'related_modal_active': True,
    'use_google_fonts_cdn': True,
}

JAZZMIN_UI_TWEAKS = {
    'navbar_small_text': False,
    'footer_small_text': True,
    'body_small_text': False,
    'brand_small_text': False,
    'brand_colour': False,
    'accent': 'accent-success',
    'navbar': 'navbar-dark',
    'no_navbar_border': True,
    'navbar_fixed': True,
    'layout_boxed': False,
    'footer_fixed': False,
    'sidebar_fixed': True,
    'sidebar': 'sidebar-dark-success',
    'sidebar_nav_small_text': False,
    'sidebar_disable_expand': False,
    'sidebar_nav_child_indent': True,
    'sidebar_nav_compact_style': True,
    'sidebar_nav_legacy_style': False,
    'sidebar_nav_flat_style': False,
    'theme': 'default',
    'dark_mode_theme': 'darkly',
    'button_classes': {
        'primary': 'btn-outline-primary',
        'secondary': 'btn-outline-secondary',
        'info': 'btn-info',
        'warning': 'btn-warning',
        'danger': 'btn-danger',
        'success': 'btn-success',
    },
}
