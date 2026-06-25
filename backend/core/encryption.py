"""
Utilitaire de chiffrement pour les données sensibles.
Utilisé pour chiffrer les clés API des providers (paiement, SMS).
"""
import base64

from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet():
    """Retourne une instance Fernet à partir de la clé de chiffrement."""
    key = settings.ENCRYPTION_KEY
    # S'assurer que la clé fait 32 bytes encodée en base64
    key_bytes = key.encode('utf-8')[:32].ljust(32, b'\0')
    key_b64 = base64.urlsafe_b64encode(key_bytes)
    return Fernet(key_b64)


def encrypt_value(plaintext: str) -> str:
    """Chiffre une valeur en texte clair. Retourne le texte chiffré en base64."""
    if not plaintext:
        return ''
    f = _get_fernet()
    return f.encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_value(ciphertext: str) -> str:
    """Déchiffre une valeur chiffrée. Retourne le texte clair."""
    if not ciphertext:
        return ''
    f = _get_fernet()
    return f.decrypt(ciphertext.encode('utf-8')).decode('utf-8')
