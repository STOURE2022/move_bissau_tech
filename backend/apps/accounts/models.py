"""
Modèles utilisateurs et OTP pour MoveBissau.
Authentification par numéro de téléphone uniquement (pas de mot de passe).
"""
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.contrib.gis.db import models as gis_models
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Manager personnalisé : création par téléphone + mot de passe."""

    def create_user(self, phone, password=None, role='passenger', **extra_fields):
        if not phone:
            raise ValueError("Le numéro de téléphone est obligatoire.")
        user = self.model(phone=phone, role=role, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(phone, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Utilisateur MoveBissau.
    Rôles : passenger, driver, admin.
    Auth par OTP SMS uniquement.
    """
    ROLE_CHOICES = [
        ('passenger', 'Passager'),
        ('driver', 'Chauffeur'),
        ('admin', 'Administrateur'),
    ]

    LANG_CHOICES = [
        ('fr', 'Français'),
        ('pt', 'Português'),
        ('gcr', 'Kriol'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=20, unique=True, verbose_name="Téléphone")
    phone_verified = models.BooleanField(default=False)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='passenger')

    first_name = models.CharField(max_length=100, blank=True, verbose_name="Prénom")
    last_name = models.CharField(max_length=100, blank=True, verbose_name="Nom")
    email = models.EmailField(blank=True, null=True)
    preferred_lang = models.CharField(
        max_length=5, choices=LANG_CHOICES, default='fr',
        verbose_name="Langue préférée"
    )
    avatar_url = models.URLField(max_length=500, blank=True)

    is_active = models.BooleanField(default=True)
    is_banned = models.BooleanField(default=False)
    ban_reason = models.TextField(blank=True)
    is_staff = models.BooleanField(default=False)

    # Dernière position connue (pour passagers et chauffeurs)
    last_location = gis_models.PointField(geography=True, srid=4326, null=True, blank=True)
    last_location_at = models.DateTimeField(null=True, blank=True)

    # Frais d'annulation impayés (dette non-croissante, conformité halal)
    cancellation_debt = models.PositiveIntegerField(
        default=0,
        verbose_name="Dette d'annulation (XOF)",
        help_text="Montant fixe, ne croît jamais. Bloque les nouvelles courses."
    )
    cancellation_debt_created_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['phone']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.phone})"

    @property
    def has_unpaid_cancellation(self):
        """Vérifie si le passager a une dette d'annulation impayée."""
        if self.cancellation_debt <= 0:
            return False
        # Vérifier si la dette a expiré (30 jours, configurable)
        from core.config_service import get_config_int
        expiry_days = get_config_int('cancellation_debt_expiry_days', 30)
        if self.cancellation_debt_created_at:
            expiry_date = self.cancellation_debt_created_at + timezone.timedelta(days=expiry_days)
            if timezone.now() > expiry_date:
                # La dette a expiré, l'annuler
                self.cancellation_debt = 0
                self.cancellation_debt_created_at = None
                self.save(update_fields=['cancellation_debt', 'cancellation_debt_created_at'])
                return False
        return True


class OTPCode(models.Model):
    """Code OTP pour l'authentification SMS."""
    PURPOSE_CHOICES = [
        ('login', 'Connexion'),
        ('verify', 'Vérification'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=20, db_index=True)
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default='login')
    attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'otp_codes'
        verbose_name = 'Code OTP'
        indexes = [
            models.Index(fields=['phone', 'is_used']),
        ]

    def __str__(self):
        return f"OTP {self.phone} ({'utilisé' if self.is_used else 'actif'})"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.is_used and not self.is_expired and self.attempts < 3
