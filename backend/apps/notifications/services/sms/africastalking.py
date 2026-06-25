"""Provider SMS Africa's Talking."""
import logging

from .base import AbstractSmsProvider, SmsResult

logger = logging.getLogger(__name__)


class AfricasTalkingProvider(AbstractSmsProvider):
    """Implémentation du provider SMS Africa's Talking."""

    def send_sms(self, phone: str, message: str) -> SmsResult:
        """Envoie un SMS via Africa's Talking."""
        try:
            import africastalking

            africastalking.initialize(
                username=self.config.get('username', 'sandbox'),
                api_key=self.config['api_key'],
            )
            sms = africastalking.SMS

            response = sms.send(
                message=message,
                recipients=[phone],
                sender_id=self.config.get('sender_id', ''),
            )

            # Vérifier le résultat
            recipients = response.get('SMSMessageData', {}).get('Recipients', [])
            if recipients and recipients[0].get('statusCode') == 101:
                return SmsResult(
                    success=True,
                    message_id=recipients[0].get('messageId'),
                )
            else:
                error = response.get('SMSMessageData', {}).get('Message', 'Erreur inconnue')
                return SmsResult(success=False, error_message=error)

        except Exception as e:
            logger.error(f"Erreur Africa's Talking SMS: {e}")
            return SmsResult(success=False, error_message=str(e))
