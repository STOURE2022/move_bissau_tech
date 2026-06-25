"""
Configuration Celery Beat — tâches périodiques.
À charger dans la config Celery.
"""
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # Expirer les demandes de course toutes les 30 secondes
    'expire-ride-requests': {
        'task': 'apps.rides.tasks.expire_ride_requests',
        'schedule': 30.0,
    },
    # Expirer les offres toutes les 30 secondes
    'expire-ride-offers': {
        'task': 'apps.rides.tasks.expire_ride_offers',
        'schedule': 30.0,
    },
    # Remettre à zéro les compteurs d'annulations à minuit
    'reset-driver-cancellations': {
        'task': 'apps.rides.tasks.reset_driver_cancellations',
        'schedule': crontab(hour=0, minute=0),
    },
    # Nettoyer les dettes d'annulation expirées à 3h du matin
    'cleanup-expired-debts': {
        'task': 'apps.rides.tasks.cleanup_expired_cancellation_debts',
        'schedule': crontab(hour=3, minute=0),
    },
}
