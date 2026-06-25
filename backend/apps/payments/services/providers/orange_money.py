"""
Provider Orange Money.
Intégration API Orange Money pour les paiements mobile money.
"""
import hashlib
import hmac
import logging

import requests

from .base import AbstractPaymentProvider, PaymentResult

logger = logging.getLogger(__name__)


class OrangeMoneyProvider(AbstractPaymentProvider):
    """Implémentation du provider Orange Money."""

    def initiate_payment(
        self,
        amount: int,
        phone: str,
        reference: str,
        description: str = '',
    ) -> PaymentResult:
        """Initie un paiement Orange Money."""
        try:
            url = f"{self.config['api_base_url']}/payment/initiate"
            headers = {
                'Authorization': f"Bearer {self.config['api_key']}",
                'Content-Type': 'application/json',
            }
            payload = {
                'merchant_id': self.config.get('merchant_id', ''),
                'amount': amount,
                'currency': 'XOF',
                'phone': phone,
                'reference': reference,
                'description': description or f'MoveBissau - Paiement {reference}',
                'callback_url': self.config.get('callback_url', ''),
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            data = response.json()

            if response.status_code == 200 and data.get('status') == 'success':
                return PaymentResult(
                    success=True,
                    transaction_id=data.get('transaction_id'),
                    provider_response=data,
                    status='processing',
                )
            else:
                return PaymentResult(
                    success=False,
                    error_message=data.get('message', 'Erreur inconnue'),
                    provider_response=data,
                    status='failed',
                )

        except requests.RequestException as e:
            logger.error(f"Erreur Orange Money initiate_payment: {e}")
            return PaymentResult(
                success=False,
                error_message=f"Erreur de connexion : {str(e)}",
                status='failed',
            )

    def check_status(self, transaction_id: str) -> PaymentResult:
        """Vérifie le statut d'un paiement Orange Money."""
        try:
            url = f"{self.config['api_base_url']}/payment/status/{transaction_id}"
            headers = {
                'Authorization': f"Bearer {self.config['api_key']}",
            }

            response = requests.get(url, headers=headers, timeout=15)
            data = response.json()

            status_map = {
                'SUCCESS': 'completed',
                'PENDING': 'processing',
                'FAILED': 'failed',
            }

            return PaymentResult(
                success=data.get('status') == 'SUCCESS',
                transaction_id=transaction_id,
                provider_response=data,
                status=status_map.get(data.get('status'), 'pending'),
            )

        except requests.RequestException as e:
            logger.error(f"Erreur Orange Money check_status: {e}")
            return PaymentResult(
                success=False,
                error_message=str(e),
                status='pending',
            )

    def verify_callback(self, payload: dict, signature: str) -> bool:
        """Vérifie la signature du callback Orange Money."""
        secret = self.config.get('api_secret', '')
        # Recalculer le HMAC et comparer
        raw = str(payload.get('transaction_id', '')) + str(payload.get('amount', ''))
        expected = hmac.new(
            secret.encode('utf-8'),
            raw.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def refund(self, transaction_id: str, amount: int = None) -> PaymentResult:
        """Rembourse un paiement Orange Money."""
        try:
            url = f"{self.config['api_base_url']}/payment/refund"
            headers = {
                'Authorization': f"Bearer {self.config['api_key']}",
                'Content-Type': 'application/json',
            }
            payload = {
                'transaction_id': transaction_id,
            }
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
            logger.error(f"Erreur Orange Money refund: {e}")
            return PaymentResult(success=False, error_message=str(e), status='failed')
