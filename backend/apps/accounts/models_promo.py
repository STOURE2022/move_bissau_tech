"""Modèles pour les codes promo et le parrainage."""
import random
import string

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import BaseModel


class PromoCode(BaseModel):
    """Code promotionnel."""
    DISCOUNT_TYPE_CHOICES = [
        ('percentage', 'Pourcentage'),
        ('fixed', 'Montant fixe (XOF)'),
    ]

    code = models.CharField(max_length=20, unique=True, db_index=True)
    description = models.TextField(blank=True)
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.PositiveIntegerField(help_text="Valeur (% ou XOF)")
    max_discount = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Plafond de réduction (XOF) pour les pourcentages"
    )
    min_ride_price = models.PositiveIntegerField(default=0, help_text="Prix minimum de course")
    max_uses = models.PositiveIntegerField(default=0, help_text="0 = illimité")
    max_uses_per_user = models.PositiveIntegerField(default=1)
    current_uses = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'promo_codes'
        verbose_name = 'Code promo'

    def __str__(self):
        return f"{self.code} — {self.discount_value}{'%' if self.discount_type == 'percentage' else ' F'}"

    @property
    def is_valid(self):
        if not self.is_active:
            return False
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        if self.max_uses > 0 and self.current_uses >= self.max_uses:
            return False
        return True

    def calculate_discount(self, ride_price):
        """Calcule la réduction pour un prix de course donné."""
        if ride_price < self.min_ride_price:
            return 0
        if self.discount_type == 'percentage':
            discount = int(ride_price * self.discount_value / 100)
            if self.max_discount:
                discount = min(discount, self.max_discount)
        else:
            discount = self.discount_value
        return min(discount, ride_price)


class PromoUsage(BaseModel):
    """Historique d'utilisation des codes promo."""
    promo_code = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='promo_usages')
    ride = models.ForeignKey('rides.Ride', on_delete=models.SET_NULL, null=True, blank=True)
    discount_amount = models.PositiveIntegerField()

    class Meta:
        db_table = 'promo_usages'
        verbose_name = "Utilisation code promo"


class Referral(BaseModel):
    """Parrainage — un utilisateur invite un autre."""
    referrer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='referrals_made'
    )
    referred = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='referred_by'
    )
    referral_code = models.CharField(max_length=10, db_index=True)
    referrer_bonus = models.PositiveIntegerField(default=500, help_text="Bonus parrain (XOF)")
    referred_bonus = models.PositiveIntegerField(default=500, help_text="Bonus filleul (XOF)")
    referrer_credited = models.BooleanField(default=False)
    referred_credited = models.BooleanField(default=False)

    class Meta:
        db_table = 'referrals'
        verbose_name = 'Parrainage'
        constraints = [
            models.UniqueConstraint(fields=['referred'], name='unique_referral_per_user')
        ]

    def __str__(self):
        return f"{self.referrer} → {self.referred} ({self.referral_code})"


def generate_referral_code():
    """Génère un code de parrainage unique de 6 caractères."""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Referral.objects.filter(referral_code=code).exists():
            return code
