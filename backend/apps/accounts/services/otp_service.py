"""
Service OTP — génération et vérification des codes SMS.
"""
import logging
import random
import string

from django.conf import settings
from django.utils import timezone

from apps.accounts.models import OTPCode

logger = logging.getLogger(__name__)


def generate_otp_code() -> str:
    """Génère un code OTP de 6 chiffres."""
    return ''.join(random.choices(string.digits, k=settings.OTP_LENGTH))


def create_otp(phone: str, purpose: str = 'login') -> OTPCode:
    """
    Crée un nouveau code OTP pour un numéro de téléphone.
    Invalide les OTP précédents non utilisés pour ce numéro.
    """
    # Invalider les OTP précédents
    OTPCode.objects.filter(
        phone=phone, is_used=False
    ).update(is_used=True)

    code = generate_otp_code()
    otp = OTPCode.objects.create(
        phone=phone,
        code=code,
        purpose=purpose,
        expires_at=timezone.now() + timezone.timedelta(
            minutes=settings.OTP_EXPIRY_MINUTES
        )
    )

    logger.info(f"OTP créé pour {phone} (purpose={purpose})")
    return otp


def verify_otp(phone: str, code: str, purpose: str = 'login') -> bool:
    """
    Vérifie un code OTP.
    Retourne True si le code est valide, False sinon.
    En mode DEBUG, n'importe quel code est accepté (dev uniquement).
    """
    # En mode dev, accepter n'importe quel code
    if settings.DEBUG:
        logger.info(f"[DEV] OTP auto-accepté pour {phone}")
        # Marquer les OTP existants comme utilisés
        OTPCode.objects.filter(phone=phone, is_used=False).update(is_used=True)
        return True

    otp = OTPCode.objects.filter(
        phone=phone,
        purpose=purpose,
        is_used=False,
    ).order_by('-created_at').first()

    if not otp:
        logger.warning(f"Aucun OTP actif trouvé pour {phone}")
        return False

    if otp.is_expired:
        logger.warning(f"OTP expiré pour {phone}")
        return False

    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        logger.warning(f"Trop de tentatives OTP pour {phone}")
        return False

    if otp.code != code:
        otp.attempts += 1
        otp.save(update_fields=['attempts'])
        logger.warning(f"Code OTP incorrect pour {phone} (tentative {otp.attempts})")
        return False

    # Code valide — marquer comme utilisé
    otp.is_used = True
    otp.save(update_fields=['is_used'])
    logger.info(f"OTP vérifié avec succès pour {phone}")
    return True
