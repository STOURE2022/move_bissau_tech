"""Permissions DRF personnalisées pour MoveBissau."""
from rest_framework.permissions import BasePermission


def _is_admin(user):
    """L'admin a accès à toutes les fonctionnalités."""
    return user and user.is_authenticated and user.role == 'admin'


class IsPassenger(BasePermission):
    """Autorise les passagers (et les admins)."""

    def has_permission(self, request, view):
        if _is_admin(request.user):
            return True
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'passenger'
        )


class IsDriver(BasePermission):
    """Autorise les chauffeurs (et les admins)."""

    def has_permission(self, request, view):
        if _is_admin(request.user):
            return True
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'driver'
        )


class IsAdmin(BasePermission):
    """Autorise uniquement les administrateurs."""

    def has_permission(self, request, view):
        return _is_admin(request.user)


class IsPassengerOrDriver(BasePermission):
    """Autorise passagers, chauffeurs (et admins)."""

    def has_permission(self, request, view):
        if _is_admin(request.user):
            return True
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('passenger', 'driver')
        )
