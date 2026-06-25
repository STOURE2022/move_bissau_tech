"""Serializers pour le dashboard admin."""
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.admin_dashboard.models import SmsProvider, SystemConfig
from apps.drivers.models import Driver, DriverDocument
from apps.incidents.models import Incident
from apps.commissions.models import Withdrawal
from apps.payments.models import PaymentProvider, Refund

User = get_user_model()


class PassengerAdminSerializer(serializers.ModelSerializer):
    """Vue admin d'un passager."""
    total_rides = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'phone', 'first_name', 'last_name', 'full_name',
            'avatar_url', 'preferred_lang', 'is_active', 'is_banned',
            'ban_reason', 'cancellation_debt', 'created_at',
            'total_rides',
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.phone

    def get_total_rides(self, obj):
        return obj.rides_as_passenger.count() if hasattr(obj, 'rides_as_passenger') else 0


class SystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = ['id', 'key', 'value', 'description', 'category', 'updated_at']
        read_only_fields = ['id']


class SystemConfigUpdateSerializer(serializers.Serializer):
    """Mise à jour d'une valeur de config."""
    value = serializers.JSONField()


class DriverDocumentAdminSerializer(serializers.ModelSerializer):
    """Document chauffeur pour l'admin."""
    class Meta:
        model = DriverDocument
        fields = ['id', 'doc_type', 'file_url', 'status', 'rejection_reason', 'created_at']


class VehicleAdminSerializer(serializers.ModelSerializer):
    """Véhicule pour l'admin."""
    class Meta:
        from apps.drivers.models import Vehicle
        model = Vehicle
        fields = ['id', 'vehicle_type', 'brand', 'model', 'color', 'plate_number', 'year']


class DriverAdminSerializer(serializers.ModelSerializer):
    """Vue admin d'un chauffeur avec documents et véhicules."""
    user_name = serializers.SerializerMethodField()
    user_phone = serializers.CharField(source='user.phone')
    avatar_url = serializers.CharField(source='user.avatar_url', default='')
    documents_count = serializers.SerializerMethodField()
    credit_balance = serializers.SerializerMethodField()
    documents = DriverDocumentAdminSerializer(many=True, read_only=True)
    vehicles = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = [
            'id', 'user_id', 'user_name', 'user_phone', 'avatar_url',
            'vehicle_type', 'is_verified', 'is_online',
            'verification_status', 'rejection_reason', 'admin_comment',
            'average_rating', 'total_rides',
            'documents_count', 'credit_balance',
            'documents', 'vehicles',
            'cancellations_today', 'forced_offline_until',
            'created_at',
        ]

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"

    def get_documents_count(self, obj):
        return obj.documents.count()

    def get_credit_balance(self, obj):
        try:
            return obj.commission_credit.balance
        except Exception:
            return 0

    def get_vehicles(self, obj):
        from apps.drivers.models import Vehicle
        vehicles = Vehicle.objects.filter(driver=obj, is_active=True)
        return [{'id': str(v.id), 'vehicle_type': v.vehicle_type, 'brand': v.brand,
                 'model': v.model, 'color': v.color, 'plate_number': v.plate_number, 'year': v.year}
                for v in vehicles]


class DriverVerifySerializer(serializers.Serializer):
    """Validation/rejet d'un chauffeur."""
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    rejection_reason = serializers.CharField(required=False, default='', allow_blank=True)
    comment = serializers.CharField(required=False, default='', allow_blank=True)


class DriverSuspendSerializer(serializers.Serializer):
    """Suspension d'un chauffeur."""
    reason = serializers.CharField(max_length=500)


class IncidentAdminSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            'id', 'ride_id', 'reported_by_name', 'incident_type',
            'description', 'status', 'priority',
            'resolution', 'resolved_at', 'created_at',
        ]

    def get_reported_by_name(self, obj):
        return f"{obj.reported_by.first_name} {obj.reported_by.last_name}"


class IncidentUpdateSerializer(serializers.Serializer):
    """Traitement d'un incident par l'admin."""
    status = serializers.ChoiceField(
        choices=['investigating', 'resolved', 'closed']
    )
    resolution = serializers.CharField(required=False, default='')
    priority = serializers.ChoiceField(
        choices=['low', 'medium', 'high', 'critical'],
        required=False
    )


class PaymentProviderAdminSerializer(serializers.ModelSerializer):
    """Vue admin d'un provider de paiement (avec config)."""
    class Meta:
        model = PaymentProvider
        fields = [
            'id', 'name', 'display_name', 'provider_type', 'is_active',
            'api_base_url', 'merchant_id', 'callback_url',
            'config', 'min_amount', 'max_amount',
            'created_at', 'updated_at',
        ]


class PaymentProviderUpdateSerializer(serializers.Serializer):
    """Mise à jour d'un provider de paiement."""
    is_active = serializers.BooleanField(required=False)
    api_base_url = serializers.URLField(required=False)
    api_key = serializers.CharField(required=False)
    api_secret = serializers.CharField(required=False)
    merchant_id = serializers.CharField(required=False)
    callback_url = serializers.URLField(required=False)
    min_amount = serializers.IntegerField(required=False)
    max_amount = serializers.IntegerField(required=False)
    config = serializers.JSONField(required=False)


class SmsProviderAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsProvider
        fields = [
            'id', 'name', 'display_name', 'is_active', 'is_primary',
            'api_base_url', 'sender_id', 'config', 'cost_per_sms',
            'created_at', 'updated_at',
        ]


class SmsProviderUpdateSerializer(serializers.Serializer):
    """Mise à jour d'un provider SMS."""
    is_active = serializers.BooleanField(required=False)
    is_primary = serializers.BooleanField(required=False)
    api_base_url = serializers.URLField(required=False)
    api_key = serializers.CharField(required=False)
    api_secret = serializers.CharField(required=False)
    sender_id = serializers.CharField(required=False)
    config = serializers.JSONField(required=False)


class RefundAdminSerializer(serializers.ModelSerializer):
    """Vue admin d'un remboursement."""
    passenger_name = serializers.SerializerMethodField()
    passenger_phone = serializers.CharField(source='passenger.phone')
    ride_price = serializers.IntegerField(source='ride.agreed_price')
    reason_display = serializers.CharField(source='get_reason_display')
    status_display = serializers.CharField(source='get_status_display')

    class Meta:
        model = Refund
        fields = [
            'id', 'reference', 'passenger_name', 'passenger_phone',
            'ride_id', 'ride_price', 'amount',
            'reason', 'reason_display', 'status', 'status_display',
            'refund_method', 'admin_note', 'provider_tx_id',
            'processed_at', 'created_at',
        ]

    def get_passenger_name(self, obj):
        return f"{obj.passenger.first_name} {obj.passenger.last_name}".strip()


class WithdrawalAdminSerializer(serializers.ModelSerializer):
    """Vue admin d'un retrait."""
    driver_name = serializers.SerializerMethodField()
    driver_phone = serializers.CharField(source='driver.user.phone')

    class Meta:
        model = Withdrawal
        fields = [
            'id', 'reference', 'driver_name', 'driver_phone',
            'amount', 'status', 'withdrawal_method', 'phone',
            'provider_tx_id', 'admin_note',
            'processed_at', 'created_at',
        ]

    def get_driver_name(self, obj):
        return f"{obj.driver.user.first_name} {obj.driver.user.last_name}".strip()
