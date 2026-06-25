"""Serializers pour les chauffeurs."""
from rest_framework import serializers

from apps.drivers.models import Driver, DriverDocument, Vehicle


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            'id', 'vehicle_type', 'brand', 'model',
            'color', 'plate_number', 'year', 'photo_url', 'is_active',
        ]
        read_only_fields = ['id']


class DriverDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverDocument
        fields = [
            'id', 'doc_type', 'file_url', 'status',
            'rejection_reason', 'reviewed_at', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'rejection_reason', 'reviewed_at']


class DriverRegistrationSerializer(serializers.Serializer):
    """Inscription comme chauffeur."""
    vehicle_type = serializers.ChoiceField(choices=['moto', 'car'])
    license_number = serializers.CharField(max_length=50, required=False, default='')


class DriverProfileSerializer(serializers.ModelSerializer):
    """Profil complet du chauffeur."""
    user_name = serializers.SerializerMethodField()
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    vehicles = VehicleSerializer(many=True, read_only=True)
    documents = DriverDocumentSerializer(many=True, read_only=True)
    credit_balance = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = [
            'id', 'user_id', 'user_name', 'user_phone',
            'vehicle_type', 'license_number',
            'is_verified', 'is_online', 'verification_status',
            'rejection_reason', 'average_rating', 'total_rides',
            'acceptance_rate', 'credit_balance',
            'vehicles', 'documents',
            'created_at',
        ]
        read_only_fields = [
            'id', 'is_verified', 'verification_status',
            'average_rating', 'total_rides',
        ]

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"

    def get_credit_balance(self, obj):
        try:
            return obj.commission_credit.balance
        except Exception:
            return 0


class LocationUpdateSerializer(serializers.Serializer):
    """Mise à jour de la position GPS du chauffeur."""
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
