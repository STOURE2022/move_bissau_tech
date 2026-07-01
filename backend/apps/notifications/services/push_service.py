"""
Service d'envoi de notifications push via Firebase Cloud Messaging (FCM).

Configuration : variable d'environnement FIREBASE_CREDENTIALS contenant
soit le chemin du fichier JSON de compte de service Firebase, soit le
contenu JSON directement (pratique sur Railway).

Se désactive silencieusement si non configuré — aucun impact sur les
requêtes API.
"""
import json
import logging
import os
import threading

logger = logging.getLogger(__name__)

_init_lock = threading.Lock()
_initialized = False
_available = False


def _ensure_initialized() -> bool:
    """Initialise Firebase une seule fois. Retourne True si le push est actif."""
    global _initialized, _available
    if _initialized:
        return _available

    with _init_lock:
        if _initialized:
            return _available
        try:
            import firebase_admin
            from firebase_admin import credentials

            raw = os.environ.get('FIREBASE_CREDENTIALS', '').strip()
            if not raw:
                logger.info("FIREBASE_CREDENTIALS non défini : push désactivé")
                _initialized = True
                return False

            if raw.startswith('{'):
                cred = credentials.Certificate(json.loads(raw))
            else:
                cred = credentials.Certificate(raw)

            firebase_admin.initialize_app(cred)
            _available = True
            logger.info("Firebase initialisé : notifications push actives")
        except Exception as e:
            logger.warning(f"Init Firebase échouée : push désactivé ({e})")
            _available = False

        _initialized = True
        return _available


def send_push_to_user(user, title: str, body: str, data: dict = None) -> int:
    """
    Envoie une notification push à tous les appareils actifs d'un utilisateur.
    Retourne le nombre d'envois réussis. Ne lève jamais d'exception.
    """
    try:
        if not _ensure_initialized():
            return 0

        from firebase_admin import messaging

        from apps.notifications.models import DeviceToken

        tokens = list(
            DeviceToken.objects.filter(user=user, is_active=True)
            .values_list('token', flat=True)
        )
        if not tokens:
            return 0

        str_data = {k: str(v) for k, v in (data or {}).items()}
        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data=str_data,
            android=messaging.AndroidConfig(priority='high'),
        )
        response = messaging.send_each_for_multicast(message)

        # Désactiver les tokens périmés (app désinstallée, token expiré…)
        invalid = [
            token
            for token, result in zip(tokens, response.responses)
            if not result.success and _is_invalid_token_error(result.exception)
        ]
        if invalid:
            DeviceToken.objects.filter(token__in=invalid).update(is_active=False)
            logger.info(f"{len(invalid)} token(s) push invalide(s) désactivé(s)")

        return response.success_count
    except Exception as e:
        logger.warning(f"Envoi push échoué (non bloquant) : {e}")
        return 0


def _is_invalid_token_error(exc) -> bool:
    try:
        from firebase_admin import messaging
        return isinstance(
            exc,
            (messaging.UnregisteredError, messaging.SenderIdMismatchError),
        )
    except Exception:
        return False
