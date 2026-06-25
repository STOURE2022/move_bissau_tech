"""
Modèles de paiement et configuration des providers.
Providers configurables depuis le dashboard admin.
"""
from django.conf import settings
from django.db import models

from core.models import BaseModel


class PaymentProvider(BaseModel):
    """
    Provider de paiement configurable depuis l'admin.
    Pattern Strategy : chaque provider a sa propre implémentation.
    """
    PROVIDER_TYPE_CHOICES = [
        ('mobile_money', 'Mobile Money'),
        ('bank', 'Banque'),
        ('card', 'Carte bancaire'),
    ]

    name = models.CharField(max_length=50, unique=True)  # 'orange_money', 'moov_money'
    display_name = models.CharField(max_length=100)
    provider_type = models.CharField(max_length=20, choices=PROVIDER_TYPE_CHOICES)
    is_active = models.BooleanField(default=False)

    # Configuration API (valeurs chiffrées en application)
    api_base_url = models.URLField(max_length=500, blank=True)
    api_key_enc = models.TextField(blank=True, verbose_name="Clé API (chiffrée)")
    api_secret_enc = models.TextField(blank=True, verbose_name="Secret API (chiffré)")
    merchant_id = models.CharField(max_length=100, blank=True)
    callback_url = models.URLField(max_length=500, blank=True)

    # Paramètres
    config = models.JSONField(default=dict, blank=True)
    min_amount = models.PositiveIntegerField(default=100, verbose_name="Montant min (XOF)")
    max_amount = models.PositiveIntegerField(default=500000, verbose_name="Montant max (XOF)")

    class Meta:
        db_table = 'payment_providers'
        verbose_name = 'Provider de paiement'

    def __str__(self):
        status = "actif" if self.is_active else "inactif"
        return f"{self.display_name} ({status})"

    @property
    def api_key(self):
        """Déchiffre et retourne la clé API."""
        from core.encryption import decrypt_value
        return decrypt_value(self.api_key_enc) if self.api_key_enc else ''

    @api_key.setter
    def api_key(self, value):
        """Chiffre et stocke la clé API."""
        from core.encryption import encrypt_value
        self.api_key_enc = encrypt_value(value) if value else ''

    @property
    def api_secret(self):
        """Déchiffre et retourne le secret API."""
        from core.encryption import decrypt_value
        return decrypt_value(self.api_secret_enc) if self.api_secret_enc else ''

    @api_secret.setter
    def api_secret(self, value):
        """Chiffre et stocke le secret API."""
        from core.encryption import encrypt_value
        self.api_secret_enc = encrypt_value(value) if value else ''


class Payment(BaseModel):
    """Paiement d'une course."""
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Espèces'),
        ('orange_money', 'Orange Money'),
        ('moov_money', 'Moov Money'),
    ]

    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('processing', 'En cours'),
        ('completed', 'Complété'),
        ('failed', 'Échoué'),
        ('refunded', 'Remboursé'),
    ]

    ride = models.ForeignKey(
        'rides.Ride', on_delete=models.CASCADE, related_name='payments'
    )
    passenger = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments_made'
    )
    driver = models.ForeignKey(
        'drivers.Driver', on_delete=models.CASCADE, related_name='payments_received'
    )

    amount = models.PositiveIntegerField(verbose_name="Montant total (XOF)")
    commission_amount = models.PositiveIntegerField(
        verbose_name="Commission plateforme (XOF)"
    )
    driver_amount = models.PositiveIntegerField(
        verbose_name="Montant chauffeur (XOF)"
    )

    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Référence mobile money
    provider_tx_id = models.CharField(max_length=100, blank=True)
    provider_name = models.CharField(max_length=50, blank=True)
    provider_response = models.JSONField(null=True, blank=True)

    # Pour le cash
    cash_confirmed_by_driver = models.BooleanField(default=False)

    class Meta:
        db_table = 'payments'
        verbose_name = 'Paiement'
        indexes = [
            models.Index(fields=['ride']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Paiement {self.amount} XOF - {self.payment_method} ({self.status})"


class Refund(BaseModel):
    """Demande de remboursement d'un passager."""
    REASON_CHOICES = [
        ('driver_noshow', 'Chauffeur absent'),
        ('driver_cancelled', 'Annulé par le chauffeur'),
        ('dispute', 'Litige passager'),
        ('admin_decision', 'Décision admin'),
    ]

    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'Approuvé'),
        ('processed', 'Traité'),
        ('rejected', 'Rejeté'),
    ]

    METHOD_CHOICES = [
        ('mobile_money', 'Mobile Money'),
        ('cash', 'Espèces (manuel)'),
    ]

    reference = models.CharField(
        max_length=20, unique=True, verbose_name="N° de référence",
        help_text="Généré automatiquement : RF-XXXXXX"
    )
    payment = models.ForeignKey(
        Payment, on_delete=models.CASCADE, related_name='refunds',
        null=True, blank=True
    )
    ride = models.ForeignKey(
        'rides.Ride', on_delete=models.CASCADE, related_name='refunds'
    )
    passenger = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='refunds'
    )
    amount = models.PositiveIntegerField(verbose_name="Montant remboursé (XOF)")
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    refund_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')

    admin_note = models.TextField(blank=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='refunds_processed'
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    provider_tx_id = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'refunds'
        verbose_name = 'Remboursement'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status'], name='refunds_status_idx'),
            models.Index(fields=['reason'], name='refunds_reason_idx'),
        ]

    def save(self, *args, **kwargs):
        if not self.reference:
            import random, string
            while True:
                ref = 'RF-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                if not Refund.objects.filter(reference=ref).exists():
                    self.reference = ref
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} — {self.amount} XOF - {self.get_reason_display()} ({self.status})"
