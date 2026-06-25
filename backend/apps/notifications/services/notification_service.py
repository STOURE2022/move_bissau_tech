"""
Service de notifications — SMS, push, et in-app.
Le provider SMS est configurable depuis l'admin.
"""
import logging

from apps.admin_dashboard.models import SmsProvider
from apps.notifications.models import Notification
from apps.notifications.services.sms.africastalking import AfricasTalkingProvider
from apps.notifications.services.sms.base import SmsResult

logger = logging.getLogger(__name__)

# Mapping nom → classe provider
SMS_PROVIDER_CLASSES = {
    'africastalking': AfricasTalkingProvider,
}


def send_sms(phone: str, message: str) -> SmsResult:
    """
    Envoie un SMS via le provider principal actif.
    Le provider est configuré dans la table sms_providers (admin dashboard).
    """
    # Récupérer le provider SMS principal
    provider_config = SmsProvider.objects.filter(
        is_active=True, is_primary=True
    ).first()

    if not provider_config:
        # Fallback sur n'importe quel provider actif
        provider_config = SmsProvider.objects.filter(is_active=True).first()

    if not provider_config:
        logger.error("Aucun provider SMS actif configuré !")
        return SmsResult(success=False, error_message="Aucun provider SMS configuré")

    provider_class = SMS_PROVIDER_CLASSES.get(provider_config.name)
    if not provider_class:
        logger.error(f"Provider SMS inconnu : {provider_config.name}")
        return SmsResult(
            success=False,
            error_message=f"Provider non supporté : {provider_config.name}"
        )

    config = {
        'api_key': provider_config.api_key,
        'api_secret': provider_config.api_secret,
        'sender_id': provider_config.sender_id,
        'username': provider_config.config.get('username', 'sandbox'),
        **provider_config.config,
    }

    provider = provider_class(config)
    result = provider.send_sms(phone, message)

    if result.success:
        logger.info(f"SMS envoyé à {phone} via {provider_config.name}")
    else:
        logger.error(f"Échec SMS à {phone}: {result.error_message}")

    return result


def send_otp_sms(phone: str, code: str) -> SmsResult:
    """Envoie le code OTP par SMS."""
    message = f"MoveBissau : votre code de vérification est {code}. Valable 5 minutes."
    return send_sms(phone, message)


def create_notification(
    user,
    title: str,
    body: str,
    notification_type: str,
    data: dict = None,
) -> Notification:
    """Crée une notification in-app pour un utilisateur."""
    return Notification.objects.create(
        user=user,
        title=title,
        body=body,
        notification_type=notification_type,
        data=data or {},
    )
