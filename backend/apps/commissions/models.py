"""
Modèles de crédit commission prépayé.
Mécanique conforme à la contrainte halal : aucun intérêt, aucune dette.
"""
from django.conf import settings
from django.db import models

from core.models import BaseModel


class CommissionCredit(BaseModel):
    """
    Solde de crédit commission d'un chauffeur.
    Un seul enregistrement par chauffeur.

    Fonctionnement :
    - Le chauffeur recharge son crédit via mobile money
    - À chaque course, la commission (15%) est déduite
    - Si solde < min_credit_for_rides, plus de nouvelles demandes
    - Aucune dette, aucun découvert autorisé, aucun intérêt
    """
    driver = models.OneToOneField(
        'drivers.Driver',
        on_delete=models.CASCADE,
        related_name='commission_credit'
    )
    balance = models.IntegerField(
        default=0,
        verbose_name="Solde (XOF)",
        help_text="Solde actuel du crédit commission. Peut être temporairement négatif si commission déduite en cours de course."
    )
    total_topups = models.PositiveIntegerField(
        default=0,
        verbose_name="Total rechargé (XOF)"
    )
    total_commissions = models.PositiveIntegerField(
        default=0,
        verbose_name="Total commissions déduites (XOF)"
    )

    class Meta:
        db_table = 'commission_credits'
        verbose_name = 'Crédit commission'
        verbose_name_plural = 'Crédits commission'

    def __str__(self):
        return f"Crédit {self.driver}: {self.balance} XOF"

    @property
    def has_sufficient_credit(self):
        """Vérifie si le chauffeur a assez de crédit pour recevoir des courses."""
        from core.config_service import get_config_int
        min_credit = get_config_int('min_credit_for_rides', 200)
        return self.balance >= min_credit


class CreditTransaction(BaseModel):
    """
    Historique des mouvements de crédit commission.
    Chaque opération est tracée pour audit complet.
    """
    TX_TYPE_CHOICES = [
        ('topup', 'Rechargement'),
        ('commission', 'Commission course'),
        ('refund', 'Remboursement'),
        ('adjustment', 'Ajustement admin'),
        ('cancellation_fee', "Frais d'annulation"),
        ('withdrawal_hold', 'Retrait en attente'),
        ('withdrawal_release', 'Retrait annulé (recrédité)'),
        ('withdrawal_completed', 'Retrait effectué'),
    ]

    driver = models.ForeignKey(
        'drivers.Driver',
        on_delete=models.CASCADE,
        related_name='credit_transactions'
    )
    tx_type = models.CharField(max_length=20, choices=TX_TYPE_CHOICES)
    amount = models.IntegerField(
        verbose_name="Montant (XOF)",
        help_text="Positif = crédit, négatif = débit"
    )
    balance_before = models.IntegerField(verbose_name="Solde avant")
    balance_after = models.IntegerField(verbose_name="Solde après")

    # Références
    ride = models.ForeignKey(
        'rides.Ride',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='credit_transactions'
    )
    payment = models.ForeignKey(
        'payments.Payment',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='credit_transactions'
    )

    # Pour les rechargements
    provider_name = models.CharField(max_length=50, blank=True)
    provider_tx_id = models.CharField(max_length=100, blank=True)

    # Pour les ajustements admin
    adjusted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='credit_adjustments'
    )
    adjustment_reason = models.TextField(blank=True)

    description = models.TextField(blank=True)

    class Meta:
        db_table = 'credit_transactions'
        verbose_name = 'Transaction crédit'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['driver']),
            models.Index(fields=['tx_type']),
            models.Index(fields=['ride']),
        ]

    def __str__(self):
        sign = '+' if self.amount >= 0 else ''
        return f"{sign}{self.amount} XOF ({self.get_tx_type_display()})"


class Withdrawal(BaseModel):
    """Demande de retrait de crédit par un chauffeur."""
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('approved', 'Approuvé'),
        ('processing', 'En cours'),
        ('completed', 'Effectué'),
        ('rejected', 'Rejeté'),
    ]

    METHOD_CHOICES = [
        ('orange_money', 'Orange Money'),
        ('moov_money', 'Moov Money'),
    ]

    reference = models.CharField(
        max_length=20, unique=True, verbose_name="N° de référence",
        help_text="Généré automatiquement : WD-XXXXXX"
    )
    driver = models.ForeignKey(
        'drivers.Driver', on_delete=models.CASCADE, related_name='withdrawals'
    )
    amount = models.PositiveIntegerField(verbose_name="Montant (XOF)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    withdrawal_method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    phone = models.CharField(max_length=20, verbose_name="Numéro de destination")

    provider_tx_id = models.CharField(max_length=100, blank=True)
    admin_note = models.TextField(blank=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='withdrawals_processed'
    )
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'withdrawals'
        verbose_name = 'Retrait'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['driver']),
        ]

    def save(self, *args, **kwargs):
        if not self.reference:
            import random, string
            while True:
                ref = 'WD-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                if not Withdrawal.objects.filter(reference=ref).exists():
                    self.reference = ref
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} — {self.amount} XOF → {self.phone} ({self.status})"
