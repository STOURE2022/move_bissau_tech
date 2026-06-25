"""Modèle de notifications."""
from django.conf import settings
from django.db import models

from core.models import BaseModel


class Notification(BaseModel):
    """Notification envoyée à un utilisateur."""
    TYPE_CHOICES = [
        ('ride_request', 'Demande de course'),
        ('ride_offer', 'Offre de course'),
        ('ride_status', 'Statut de course'),
        ('payment', 'Paiement'),
        ('credit_low', 'Crédit bas'),
        ('credit_topup', 'Rechargement crédit'),
        ('rating', 'Notation'),
        ('incident', 'Incident'),
        ('system', 'Système'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    body = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'notifications'
        verbose_name = 'Notification'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f"{self.title} → {self.user}"
