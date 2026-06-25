"""
Modèles chauffeur, documents et véhicules.
"""
from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models

from core.models import BaseModel


class Driver(BaseModel):
    """Profil chauffeur — extension du modèle User."""
    VEHICLE_TYPE_CHOICES = [
        ('moto', 'Moto-taxi'),
        ('car', 'Voiture'),
    ]

    VERIFICATION_STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'Approuvé'),
        ('rejected', 'Rejeté'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='driver_profile'
    )
    vehicle_type = models.CharField(max_length=10, choices=VEHICLE_TYPE_CHOICES)
    license_number = models.CharField(max_length=50, blank=True)

    is_verified = models.BooleanField(default=False, verbose_name="Documents validés")
    is_online = models.BooleanField(default=False, verbose_name="En ligne")
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        default='pending'
    )
    rejection_reason = models.TextField(blank=True)
    admin_comment = models.TextField(blank=True, verbose_name="Commentaire admin")

    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_rides = models.PositiveIntegerField(default=0)
    acceptance_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=100.00,
        verbose_name="Taux d'acceptation (%)"
    )

    # Position GPS en temps réel
    current_location = gis_models.PointField(
        geography=True, srid=4326, null=True, blank=True
    )
    location_updated_at = models.DateTimeField(null=True, blank=True)

    # Compteur d'annulations (remis à zéro toutes les 24h par tâche Celery)
    cancellations_today = models.PositiveIntegerField(default=0)
    forced_offline_until = models.DateTimeField(
        null=True, blank=True,
        verbose_name="Mis hors ligne jusqu'à"
    )

    class Meta:
        db_table = 'drivers'
        verbose_name = 'Chauffeur'
        verbose_name_plural = 'Chauffeurs'
        indexes = [
            models.Index(fields=['is_online', 'is_verified']),
        ]

    def __str__(self):
        return f"Chauffeur {self.user.first_name} ({self.vehicle_type})"

    @property
    def is_available(self):
        """Le chauffeur est-il disponible pour recevoir des demandes ?"""
        from django.utils import timezone
        if self.forced_offline_until and timezone.now() < self.forced_offline_until:
            return False
        return self.is_online and self.is_verified and not self.user.is_banned


class DriverDocument(BaseModel):
    """Document soumis par un chauffeur pour vérification."""
    DOC_TYPE_CHOICES = [
        ('identity', "Pièce d'identité"),
        ('license', 'Permis de conduire'),
        ('insurance', 'Assurance'),
        ('criminal_record', 'Casier judiciaire'),
        ('vehicle_registration', 'Carte grise'),
        ('photo', 'Photo du véhicule'),
    ]

    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'Approuvé'),
        ('rejected', 'Rejeté'),
    ]

    driver = models.ForeignKey(
        Driver, on_delete=models.CASCADE, related_name='documents'
    )
    doc_type = models.CharField(max_length=30, choices=DOC_TYPE_CHOICES)
    file_url = models.URLField(max_length=500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_documents'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'driver_documents'
        verbose_name = 'Document chauffeur'
        indexes = [
            models.Index(fields=['driver', 'doc_type']),
        ]

    def __str__(self):
        return f"{self.get_doc_type_display()} - {self.driver}"


class Vehicle(BaseModel):
    """Véhicule d'un chauffeur."""
    VEHICLE_TYPE_CHOICES = [
        ('moto', 'Moto'),
        ('car', 'Voiture'),
    ]

    driver = models.ForeignKey(
        Driver, on_delete=models.CASCADE, related_name='vehicles'
    )
    vehicle_type = models.CharField(max_length=10, choices=VEHICLE_TYPE_CHOICES)
    brand = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    color = models.CharField(max_length=50, blank=True)
    plate_number = models.CharField(max_length=20, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'vehicles'
        verbose_name = 'Véhicule'

    def __str__(self):
        return f"{self.brand} {self.model} ({self.plate_number})"
