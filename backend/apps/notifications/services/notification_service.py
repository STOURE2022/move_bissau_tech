"""
Service de notifications — SMS, push, et in-app.
Le provider SMS est configurable depuis l'admin.
"""
import logging
import threading

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


# === Notifications d'événements de course (in-app + push, localisées) ===

# key → {lang: (title, body)} — le corps accepte des paramètres {name}
PUSH_MESSAGES = {
    'new_request': {
        'fr': ('Nouvelle course !', '{price} F CFA · {pickup}'),
        'pt': ('Nova viagem!', '{price} F CFA · {pickup}'),
        'gcr': ('Viaji nobu!', '{price} F CFA · {pickup}'),
    },
    'new_offer': {
        'fr': ('Nouvelle offre', '{driver} propose {price} F CFA'),
        'pt': ('Nova oferta', '{driver} propõe {price} F CFA'),
        'gcr': ('Oferta nobu', '{driver} fala {price} F CFA'),
    },
    'offer_accepted': {
        'fr': ('Offre acceptée !', 'Course confirmée — {price} F CFA'),
        'pt': ('Oferta aceite!', 'Viagem confirmada — {price} F CFA'),
        'gcr': ('Oferta setadu!', 'Viaji konfirmadu — {price} F CFA'),
    },
    'driver_en_route': {
        'fr': ('Chauffeur en route', '{driver} est en chemin'),
        'pt': ('Motorista a caminho', '{driver} está a caminho'),
        'gcr': ('Xofer na bin', '{driver} sta na kaminu'),
    },
    'driver_arrived': {
        'fr': ('Votre chauffeur est arrivé !', '{driver} vous attend'),
        'pt': ('O motorista chegou!', '{driver} está à sua espera'),
        'gcr': ('Xofer txiga!', '{driver} na spera bu'),
    },
    'ride_completed': {
        'fr': ('Course terminée', 'Montant à payer : {price} F CFA'),
        'pt': ('Viagem concluída', 'Valor a pagar: {price} F CFA'),
        'gcr': ('Viaji kaba', 'Valor pa paga: {price} F CFA'),
    },
    'cancelled_by_passenger': {
        'fr': ('Course annulée', 'Le passager a annulé la course'),
        'pt': ('Viagem cancelada', 'O passageiro cancelou a viagem'),
        'gcr': ('Viaji kanseladu', 'Pasajeru kansela viaji'),
    },
    'cancelled_by_driver': {
        'fr': ('Course annulée', 'Le chauffeur a annulé la course. Faites une nouvelle demande.'),
        'pt': ('Viagem cancelada', 'O motorista cancelou a viagem. Faça um novo pedido.'),
        'gcr': ('Viaji kanseladu', 'Xofer kansela viaji. Fasi un pedidu nobu.'),
    },
    'sos_alert': {
        'fr': ('🚨 SOS déclenché !', 'Course #{ride} — SOS du {by}. Intervention immédiate requise.'),
        'pt': ('🚨 SOS acionado!', 'Viagem #{ride} — SOS do {by}. Intervenção imediata necessária.'),
        'gcr': ('🚨 SOS!', 'Viaji #{ride} — SOS di {by}. Misti intervenson gosi.'),
    },
    'referral_bonus_credit': {
        'fr': ('Bonus parrainage 🎉', '+{amount} F CFA ajoutés à votre crédit commission'),
        'pt': ('Bónus de convite 🎉', '+{amount} F CFA adicionados ao seu crédito comissão'),
        'gcr': ('Bonus di konvida 🎉', '+{amount} F CFA pui na bu kreditu komisaun'),
    },
    'referral_bonus_promo': {
        'fr': ('Bonus parrainage 🎉', 'Vous avez gagné {amount} F CFA de réduction ! Code : {code}'),
        'pt': ('Bónus de convite 🎉', 'Ganhou {amount} F CFA de desconto! Código: {code}'),
        'gcr': ('Bonus di konvida 🎉', 'Bu gaña {amount} F CFA di diskontu! Kodigu: {code}'),
    },
}


def notify_user(
    user,
    message_key: str,
    params: dict = None,
    notification_type: str = 'system',
    data: dict = None,
):
    """
    Notifie un utilisateur d'un événement : notification in-app + push FCM,
    dans sa langue préférée. Ne lève jamais d'exception (best effort).
    """
    try:
        lang = getattr(user, 'preferred_lang', 'fr') or 'fr'
        messages = PUSH_MESSAGES.get(message_key)
        if not messages:
            logger.warning(f"Message de notification inconnu : {message_key}")
            return

        title, body = messages.get(lang) or messages['fr']
        if params:
            title = title.format(**params)
            body = body.format(**params)

        create_notification(
            user, title=title, body=body,
            notification_type=notification_type, data=data,
        )

        from apps.notifications.services.push_service import send_push_to_user
        send_push_to_user(user, title, body, data=data)
    except Exception as e:
        logger.warning(f"notify_user échoué (non bloquant) : {e}")


def notify_users_async(
    users,
    message_key: str,
    params: dict = None,
    notification_type: str = 'system',
    data: dict = None,
):
    """
    Notifie un ou plusieurs utilisateurs dans un thread d'arrière-plan,
    pour ne pas ajouter la latence FCM au temps de réponse de l'API.
    (Pas de worker Celery en production : les threads sont le fallback.)
    """
    users = list(users)
    if not users:
        return

    def _run():
        try:
            for user in users:
                notify_user(
                    user, message_key,
                    params=params,
                    notification_type=notification_type,
                    data=data,
                )
        finally:
            # Le thread a sa propre connexion DB : la fermer proprement
            from django.db import connection
            connection.close()

    threading.Thread(target=_run, daemon=True).start()


def notify_user_async(user, message_key: str, **kwargs):
    """Variante mono-utilisateur de notify_users_async."""
    notify_users_async([user], message_key, **kwargs)


def push_only_async(user, title: str, body: str, data: dict = None):
    """
    Envoie uniquement une push (sans notification in-app), dans un thread
    d'arrière-plan. Utilisé pour les messages de chat : l'historique est
    déjà dans la conversation, inutile de dupliquer en base.
    """
    def _run():
        try:
            from apps.notifications.services.push_service import send_push_to_user
            send_push_to_user(user, title, body, data=data)
        except Exception as e:
            logger.warning(f"push_only_async échoué (non bloquant) : {e}")
        finally:
            from django.db import connection
            connection.close()

    threading.Thread(target=_run, daemon=True).start()
