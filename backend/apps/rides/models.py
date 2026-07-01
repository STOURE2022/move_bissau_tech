"""
Modèles pour les demandes de course, offres et courses.
Cœur métier de la négociation de prix.
"""
import secrets

from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.db import models

from core.models import BaseModel


class RideRequest(BaseModel):
    """
    Demande de course par un passager.
    Le passager propose un prix, les chauffeurs répondent.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('offers_received', 'Offres reçues'),
        ('accepted', 'Acceptée'),
        ('expired', 'Expirée'),
        ('cancelled', 'Annulée'),
    ]

    VEHICLE_TYPE_CHOICES = [
        ('moto', 'Moto-taxi'),
        ('car', 'Voiture'),
    ]

    passenger = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ride_requests'
    )

    # Localisation
    pickup_location = gis_models.PointField(geography=True, srid=4326)
    pickup_address = models.CharField(max_length=500, blank=True)
    dropoff_location = gis_models.PointField(geography=True, srid=4326)
    dropoff_address = models.CharField(max_length=500, blank=True)

    # Prix
    estimated_distance_m = models.PositiveIntegerField(
        verbose_name="Distance estimée (m)"
    )
    suggested_price = models.PositiveIntegerField(
        verbose_name="Prix indicatif (XOF)"
    )
    proposed_price = models.PositiveIntegerField(
        verbose_name="Prix proposé par le passager (XOF)"
    )

    # Préférences
    vehicle_type = models.CharField(max_length=10, choices=VEHICLE_TYPE_CHOICES)

    LUGGAGE_CHOICES = [
        ('none', 'Aucun bagage'),
        ('small', 'Petit sac'),
        ('suitcase', 'Valise'),
        ('large', 'Gros bagage'),
    ]
    luggage_type = models.CharField(max_length=10, choices=LUGGAGE_CHOICES, default='none')

    # Code promo (validé à la création, appliqué à l'acceptation d'une offre)
    promo_code = models.CharField(max_length=20, blank=True)

    # Matching
    search_radius_m = models.PositiveIntegerField(
        verbose_name="Rayon de recherche (m)"
    )
    max_drivers_notified = models.PositiveIntegerField(
        verbose_name="Max chauffeurs notifiés"
    )
    notified_count = models.PositiveIntegerField(default=0)

    # Statut
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    expires_at = models.DateTimeField()
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'ride_requests'
        verbose_name = 'Demande de course'
        verbose_name_plural = 'Demandes de course'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['passenger']),
        ]

    def __str__(self):
        return f"Demande #{str(self.id)[:8]} - {self.proposed_price} XOF ({self.status})"


class RideOffer(BaseModel):
    """
    Offre d'un chauffeur en réponse à une demande.
    Peut être une acceptation du prix ou une contre-offre.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('accepted', 'Acceptée'),
        ('rejected', 'Rejetée'),
        ('expired', 'Expirée'),
        ('withdrawn', 'Retirée'),
    ]

    ride_request = models.ForeignKey(
        RideRequest, on_delete=models.CASCADE, related_name='offers'
    )
    driver = models.ForeignKey(
        'drivers.Driver', on_delete=models.CASCADE, related_name='ride_offers'
    )

    # Prix
    offered_price = models.PositiveIntegerField(
        verbose_name="Prix proposé par le chauffeur (XOF)"
    )
    is_counter_offer = models.BooleanField(
        default=False,
        verbose_name="Est une contre-offre"
    )

    # Info chauffeur au moment de l'offre
    driver_distance_m = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name="Distance chauffeur → passager (m)"
    )
    estimated_arrival_s = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name="Temps d'arrivée estimé (s)"
    )
    driver_rating = models.DecimalField(
        max_digits=3, decimal_places=2, null=True, blank=True
    )

    # Statut
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'ride_offers'
        verbose_name = 'Offre de course'
        verbose_name_plural = 'Offres de course'
        constraints = [
            models.UniqueConstraint(
                fields=['ride_request', 'driver'],
                name='unique_offer_per_driver_per_request'
            )
        ]
        indexes = [
            models.Index(fields=['ride_request']),
            models.Index(fields=['driver']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Offre {self.offered_price} XOF par {self.driver} ({self.status})"


class Ride(BaseModel):
    """
    Course confirmée — créée quand le passager accepte une offre.
    Cycle de vie complet avec tous les statuts.
    """
    STATUS_CHOICES = [
        ('driver_assigned', 'Chauffeur assigné'),
        ('driver_en_route', 'Chauffeur en route'),
        ('driver_arrived', 'Chauffeur arrivé'),
        ('passenger_onboard', 'Passager à bord'),
        ('completed', 'Terminée'),
        ('paid', 'Payée'),
        ('cancelled', 'Annulée'),
    ]

    CANCELLED_BY_CHOICES = [
        ('passenger', 'Passager'),
        ('driver', 'Chauffeur'),
        ('system', 'Système'),
    ]

    VEHICLE_TYPE_CHOICES = [
        ('moto', 'Moto-taxi'),
        ('car', 'Voiture'),
    ]

    ride_request = models.OneToOneField(
        RideRequest, on_delete=models.CASCADE, related_name='ride'
    )
    ride_offer = models.OneToOneField(
        RideOffer, on_delete=models.CASCADE, related_name='ride'
    )
    passenger = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='rides_as_passenger'
    )
    driver = models.ForeignKey(
        'drivers.Driver', on_delete=models.CASCADE, related_name='rides'
    )

    # Localisations
    pickup_location = gis_models.PointField(geography=True, srid=4326)
    pickup_address = models.CharField(max_length=500, blank=True)
    dropoff_location = gis_models.PointField(geography=True, srid=4326)
    dropoff_address = models.CharField(max_length=500, blank=True)
    actual_route = gis_models.LineStringField(
        geography=True, srid=4326, null=True, blank=True
    )

    # Prix et commission
    agreed_price = models.PositiveIntegerField(verbose_name="Prix convenu (XOF)")
    actual_distance_m = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name="Distance réelle (m)"
    )
    commission_amount = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name="Commission (XOF)"
    )
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=15.00,
        verbose_name="Taux de commission (%)"
    )

    # Promo : réduction financée par la plateforme (le chauffeur est
    # compensé sur son crédit commission, le passager paie amount_due)
    promo_code = models.CharField(max_length=20, blank=True)
    discount_amount = models.PositiveIntegerField(
        default=0, verbose_name="Réduction promo (XOF)"
    )

    vehicle_type = models.CharField(max_length=10, choices=VEHICLE_TYPE_CHOICES)

    # Statut
    status = models.CharField(
        max_length=25, choices=STATUS_CHOICES, default='driver_assigned'
    )

    # Timestamps du cycle de vie
    driver_assigned_at = models.DateTimeField(auto_now_add=True)
    driver_en_route_at = models.DateTimeField(null=True, blank=True)
    driver_arrived_at = models.DateTimeField(null=True, blank=True)
    passenger_onboard_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # Annulation
    cancelled_by = models.CharField(
        max_length=10, choices=CANCELLED_BY_CHOICES,
        null=True, blank=True
    )
    cancellation_reason = models.TextField(blank=True)
    cancellation_fee = models.PositiveIntegerField(
        default=0,
        verbose_name="Frais d'annulation (XOF)"
    )

    # Partage de trajet et SOS
    share_token = models.CharField(
        max_length=64, unique=True, null=True, blank=True
    )
    share_expires_at = models.DateTimeField(null=True, blank=True)
    emergency_triggered = models.BooleanField(default=False)

    class Meta:
        db_table = 'rides'
        verbose_name = 'Course'
        verbose_name_plural = 'Courses'
        indexes = [
            models.Index(fields=['passenger']),
            models.Index(fields=['driver']),
            models.Index(fields=['status']),
        ]

    @property
    def amount_due(self) -> int:
        """Montant que le passager paie réellement (prix convenu - promo)."""
        return max(0, self.agreed_price - self.discount_amount)

    def __str__(self):
        return f"Course #{str(self.id)[:8]} - {self.agreed_price} XOF ({self.status})"

    def generate_share_token(self):
        """Génère un token unique pour le partage de trajet."""
        self.share_token = secrets.token_urlsafe(48)
        from django.utils import timezone
        self.share_expires_at = timezone.now() + timezone.timedelta(hours=4)
        self.save(update_fields=['share_token', 'share_expires_at'])
        return self.share_token

    # === Transitions de statut autorisées ===
    ALLOWED_TRANSITIONS = {
        'driver_assigned': ['driver_en_route', 'cancelled'],
        'driver_en_route': ['driver_arrived', 'cancelled'],
        'driver_arrived': ['passenger_onboard', 'cancelled'],
        'passenger_onboard': ['completed', 'cancelled'],
        'completed': ['paid'],
        'paid': [],
        'cancelled': [],
    }

    def can_transition_to(self, new_status):
        """Vérifie si la transition de statut est autorisée."""
        return new_status in self.ALLOWED_TRANSITIONS.get(self.status, [])
