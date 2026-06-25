"""
Modèles de configuration système et providers SMS.
Toutes les valeurs métier sont configurables depuis le dashboard admin.
"""
from django.conf import settings
from django.db import models

from core.models import BaseModel


class SystemConfig(BaseModel):
    """
    Configuration système clé-valeur.
    Toutes les valeurs métier configurables par l'admin.
    Changements pris en compte sous 5 minutes (cache Redis).
    """
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=50, default='general',
        verbose_name="Catégorie",
        help_text="Pour regrouper dans le dashboard : general, pricing, matching, commission, cancellation, rating"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )

    class Meta:
        db_table = 'system_config'
        verbose_name = 'Configuration système'
        verbose_name_plural = 'Configurations système'

    def __str__(self):
        return f"{self.key} = {self.value}"

    def save(self, *args, **kwargs):
        """Invalide le cache Redis à chaque modification."""
        super().save(*args, **kwargs)
        from core.config_service import invalidate_config
        invalidate_config(self.key)


class SmsProvider(BaseModel):
    """Provider SMS configurable depuis l'admin."""
    name = models.CharField(max_length=50, unique=True)  # 'africastalking', 'twilio'
    display_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False)
    is_primary = models.BooleanField(default=False, verbose_name="Provider principal")

    api_base_url = models.URLField(max_length=500, blank=True)
    api_key_enc = models.TextField(blank=True, verbose_name="Clé API (chiffrée)")
    api_secret_enc = models.TextField(blank=True, verbose_name="Secret API (chiffré)")
    sender_id = models.CharField(max_length=20, blank=True, default='MoveBissau')

    config = models.JSONField(default=dict, blank=True)
    cost_per_sms = models.DecimalField(
        max_digits=10, decimal_places=4,
        null=True, blank=True,
        verbose_name="Coût estimé par SMS (USD)"
    )

    class Meta:
        db_table = 'sms_providers'
        verbose_name = 'Provider SMS'

    def __str__(self):
        status = "principal" if self.is_primary else ("actif" if self.is_active else "inactif")
        return f"{self.display_name} ({status})"

    @property
    def api_key(self):
        from core.encryption import decrypt_value
        return decrypt_value(self.api_key_enc) if self.api_key_enc else ''

    @api_key.setter
    def api_key(self, value):
        from core.encryption import encrypt_value
        self.api_key_enc = encrypt_value(value) if value else ''

    @property
    def api_secret(self):
        from core.encryption import decrypt_value
        return decrypt_value(self.api_secret_enc) if self.api_secret_enc else ''

    @api_secret.setter
    def api_secret(self, value):
        from core.encryption import encrypt_value
        self.api_secret_enc = encrypt_value(value) if value else ''
