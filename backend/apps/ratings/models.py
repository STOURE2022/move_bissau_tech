"""Modèle de notation mutuelle passager ↔ chauffeur."""
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import BaseModel


class Rating(BaseModel):
    """Notation d'une course (dans les deux sens)."""
    ROLE_CHOICES = [
        ('passenger', 'Passager'),
        ('driver', 'Chauffeur'),
    ]

    ride = models.ForeignKey(
        'rides.Ride', on_delete=models.CASCADE, related_name='ratings'
    )
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ratings_given'
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ratings_received'
    )
    role = models.CharField(
        max_length=10, choices=ROLE_CHOICES,
        verbose_name="Rôle du notateur"
    )
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(max_length=500, blank=True)

    class Meta:
        db_table = 'ratings'
        verbose_name = 'Notation'
        constraints = [
            models.UniqueConstraint(
                fields=['ride', 'from_user'],
                name='unique_rating_per_user_per_ride'
            )
        ]
        indexes = [
            models.Index(fields=['to_user']),
            models.Index(fields=['ride']),
        ]

    def __str__(self):
        return f"{self.score}★ par {self.from_user} → {self.to_user}"
