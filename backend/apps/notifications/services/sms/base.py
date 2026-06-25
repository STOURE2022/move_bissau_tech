"""Interface abstraite pour les providers SMS."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class SmsResult:
    """Résultat d'un envoi SMS."""
    success: bool
    message_id: Optional[str] = None
    error_message: Optional[str] = None


class AbstractSmsProvider(ABC):
    """Interface commune pour tous les providers SMS."""

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    def send_sms(self, phone: str, message: str) -> SmsResult:
        """Envoie un SMS à un numéro de téléphone."""
        pass
