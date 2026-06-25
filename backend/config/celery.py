"""Configuration Celery pour MoveBissau."""
import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

app = Celery('movebissau')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Découverte automatique des tâches dans chaque app
app.autodiscover_tasks()
