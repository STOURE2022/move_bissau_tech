"""
Interface abstraite pour les providers de paiement.
Pattern Strategy : chaque provider implémente cette interface.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class PaymentResult:
    """Résultat d'une opération de paiement."""
    success: bool
    transaction_id: Optional[str] = None
    error_message: Optional[str] = None
    provider_response: Optional[dict] = None
    status: str = 'pending'  # pending, completed, failed


class AbstractPaymentProvider(ABC):
    """Interface commune pour tous les providers de paiement."""

    def __init__(self, config: dict):
        """
        Initialise le provider avec sa configuration.
        config contient : api_key, api_secret, merchant_id, api_base_url, etc.
        """
        self.config = config

    @abstractmethod
    def initiate_payment(
        self,
        amount: int,
        phone: str,
        reference: str,
        description: str = '',
    ) -> PaymentResult:
        """
        Initie un paiement mobile money.

        Args:
            amount: Montant en XOF
            phone: Numéro de téléphone du payeur
            reference: Référence interne (ID course/transaction)
            description: Description du paiement
        """
        pass

    @abstractmethod
    def check_status(self, transaction_id: str) -> PaymentResult:
        """Vérifie le statut d'un paiement en cours."""
        pass

    @abstractmethod
    def verify_callback(self, payload: dict, signature: str) -> bool:
        """Vérifie la signature d'un callback webhook."""
        pass

    @abstractmethod
    def refund(self, transaction_id: str, amount: int = None) -> PaymentResult:
        """Rembourse un paiement (total ou partiel)."""
        pass
