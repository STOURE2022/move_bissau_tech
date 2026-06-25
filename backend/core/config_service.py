"""
Service de configuration système.
Lit les valeurs depuis la table system_config avec cache Redis.
Toutes les valeurs métier configurables passent par ce service.
"""
import json
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Durée de cache : 5 minutes (les changements admin prennent effet sous 5 min)
CACHE_TTL = 300
CACHE_PREFIX = 'sysconfig:'


def get_config(key: str, default=None):
    """
    Récupère une valeur de configuration système.
    Priorité : cache Redis → base de données → valeur par défaut.
    """
    cache_key = f'{CACHE_PREFIX}{key}'

    # 1. Vérifier le cache
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # 2. Lire en base
    try:
        from apps.admin_dashboard.models import SystemConfig
        config_obj = SystemConfig.objects.filter(key=key).first()
        if config_obj:
            value = config_obj.value
            # Si c'est une string, essayer de parser en JSON (pour les nombres, listes, etc.)
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except (json.JSONDecodeError, ValueError):
                    pass  # Garder comme string simple
            cache.set(cache_key, value, CACHE_TTL)
            return value
    except Exception as e:
        logger.warning(f"Erreur lecture config '{key}': {e}")

    return default


def get_config_int(key: str, default: int = 0) -> int:
    """Récupère une config en int."""
    value = get_config(key, default)
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def get_config_float(key: str, default: float = 0.0) -> float:
    """Récupère une config en float."""
    value = get_config(key, default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def invalidate_config(key: str):
    """Invalide le cache pour une clé (appelé après modification admin)."""
    cache.delete(f'{CACHE_PREFIX}{key}')


def invalidate_all_config():
    """Invalide tout le cache de configuration."""
    try:
        from apps.admin_dashboard.models import SystemConfig
        for config_obj in SystemConfig.objects.all():
            cache.delete(f'{CACHE_PREFIX}{config_obj.key}')
    except Exception:
        pass
