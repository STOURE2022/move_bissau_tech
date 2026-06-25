"""Modèle d'incidents et litiges."""
from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models

from core.models import BaseModel


class Incident(BaseModel):
    """Incident ou litige signalé sur une course."""
    TYPE_CHOICES = [
        ('sos_emergency', 'Urgence SOS'),
        ('dispute', 'Litige'),
        ('driver_behavior', 'Comportement chauffeur'),
        ('passenger_behavior', 'Comportement passager'),
        ('accident', 'Accident'),
        ('payment_issue', 'Problème paiement'),
        ('other', 'Autre'),
    ]

    STATUS_CHOICES = [
        ('open', 'Ouvert'),
        ('investigating', 'En investigation'),
        ('resolved', 'Résolu'),
        ('closed', 'Fermé'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Basse'),
        ('medium', 'Moyenne'),
        ('high', 'Haute'),
        ('critical', 'Critique'),
    ]

    ride = models.ForeignKey(
        'rides.Ride',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='incidents'
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='incidents_reported'
    )

    incident_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    description = models.TextField()
    location = gis_models.PointField(
        geography=True, srid=4326, null=True, blank=True
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')

    # Résolution
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents_assigned'
    )
    resolution = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'incidents'
        verbose_name = 'Incident'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['ride']),
        ]

    def __str__(self):
        return f"Incident {self.get_incident_type_display()} ({self.status})"
