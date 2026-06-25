"""Serializers pour les incidents."""
from rest_framework import serializers

from apps.incidents.models import Incident


class IncidentCreateSerializer(serializers.Serializer):
    """Signaler un incident."""
    ride_id = serializers.UUIDField(required=False)
    incident_type = serializers.ChoiceField(choices=[
        'dispute', 'driver_behavior', 'passenger_behavior',
        'accident', 'payment_issue', 'other',
    ])
    description = serializers.CharField(max_length=2000)
    latitude = serializers.FloatField(required=False)
    longitude = serializers.FloatField(required=False)


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = [
            'id', 'ride_id', 'incident_type', 'description',
            'status', 'priority', 'resolution', 'resolved_at',
            'created_at',
        ]
