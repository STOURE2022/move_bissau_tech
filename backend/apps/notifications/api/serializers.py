"""Serializers pour les notifications et tokens d'appareils."""
from rest_framework import serializers

from apps.notifications.models import DeviceToken, Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'body', 'data', 'notification_type',
            'is_read', 'read_at', 'created_at',
        ]


class DeviceTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=512)
    platform = serializers.ChoiceField(
        choices=[c[0] for c in DeviceToken.PLATFORM_CHOICES],
        default='android',
    )
