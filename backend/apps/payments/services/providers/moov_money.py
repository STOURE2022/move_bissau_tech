"""
Provider Moov Money.
Intégration API Moov Money pour les paiements mobile money.
"""
import hashlib
import hmac
import logging

import requests

from .base import AbstractPaymentProvider, PaymentResult

logger = logging.getLogger(__name__)


class MoovMoneyProvider(AbstractPaymentProvider):
    """Implémentation du provider Moov Money."""

    def initiate_payment(
        self,
        amount: int,
        phone: str,
        reference: str,
        description: str = '',
    ) -> PaymentResult:
        """Initie un paiement Moov Money."""
        try:
            url = f"{self.config['api_base_url']}/api/v1/payment"
            headers = {
                'X-API-Key': self.config['api_key'],
                'Content-Type': 'application/json',
            }
            payload = {
                'amount': amount,
                'currency': 'XOF',
                'customer_phone': phone,
                'merchant_reference': reference,
                'description': description or f'MoveBissau - {reference}',
                'callback_url': self.config.get('callback_url', ''),
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            data = response.json()

            if response.status_code in (200, 201) and data.get('success'):
                return PaymentResult(
                    success=True,
                    transaction_id=data.get('transaction_id'),
                    provider_response=data,
                    status='processing',
                )
            else:
                return PaymentResult(
                    success=False,
                    error_message=data.get('error', 'Erreur inconnue'),
                    provider_response=data,
                    status='failed',
                )

        except requests.RequestException as e:
            logger.error(f"Erreur Moov Money initiate_payment: {e}")
            return PaymentResult(
                success=False,
                error_message=f"Erreur de connexion : {str(e)}",
                status='failed',
            )

    def check_status(self, transaction_id: str) -> PaymentResult:
        """Vérifie le statut d'un paiement Moov Money."""
        try:
            url = f"{self.config['api_base_url']}/api/v1/payment/{transaction_id}"
            headers = {'X-API-Key': self.config['api_key']}

            response = requests.get(url, headers=headers, timeout=15)
            data = response.json()

            status_map = {
                'COMPLETED': 'completed',
                'PENDING': 'processing',
                'FAILED': 'failed',
                'CANCELLED': 'failed',
            }

            return PaymentResult(
                success=data.get('status') == 'COMPLETED',
                transaction_id=transaction_id,
                provider_response=data,
                status=status_map.get(data.get('status'), 'pending'),
            )

        except requests.RequestException as e:
            logger.error(f"Erreur Moov Money check_status: {e}")
            return PaymentResult(success=False, error_message=str(e), status='pending')

    def verify_callback(self, payload: dict, signature: str) -> bool:
        """Vérifie la signature du callback Moov Money."""
        secret = self.config.get('api_secret', '')
        raw = str(payload.get('transaction_id', '')) + str(payload.get('status', ''))
        expected = hmac.new(
            secret.encode('utf-8'),
            raw.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def refund(self, transaction_id: str, amount: int = None) -> PaymentResult:
        """Rembourse un paiement Moov Money."""
        try:
            url = f"{self.config['api_base_url']}/api/v1/refund"
            headers = {
                'X-API-Key': self.config['api_key'],
                'Content-Type': 'application/json',
            }
            payload = {'transaction_id': transaction_id}
            if amount:
                payload['amount'] = amount

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            data = response.json()

            return PaymentResult(
                success=response.status_code == 200,
                transaction_id=data.get('refund_id'),
                provider_response=data,
                status='completed' if response.status_code == 200 else 'failed',
            )

        except requests.RequestException as e:
            logger.error(f"Erreur Moov Money refund: {e}")
            return PaymentResult(success=False, error_message=str(e), status='failed')
