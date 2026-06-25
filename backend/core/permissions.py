"""Permissions DRF personnalisées pour MoveBissau."""
from rest_framework.permissions import BasePermission


class IsPassenger(BasePermission):
    """Autorise uniquement les passagers."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'passenger'
        )


class IsDriver(BasePermission):
    """Autorise uniquement les chauffeurs."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'driver'
        )


class IsAdmin(BasePermission):
    """Autorise uniquement les administrateurs."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )


class IsPassengerOrDriver(BasePermission):
    """Autorise passagers et chauffeurs."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('passenger', 'driver')
        )
