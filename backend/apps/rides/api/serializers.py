"""Serializers pour les courses."""
from rest_framework import serializers

from apps.rides.models import Ride, RideMessage, RideOffer, RideRequest


class PriceEstimateSerializer(serializers.Serializer):
    """Entrée pour l'estimation de prix."""
    pickup_lat = serializers.FloatField(min_value=-90, max_value=90)
    pickup_lng = serializers.FloatField(min_value=-180, max_value=180)
    dropoff_lat = serializers.FloatField(min_value=-90, max_value=90)
    dropoff_lng = serializers.FloatField(min_value=-180, max_value=180)
    vehicle_type = serializers.ChoiceField(choices=['moto', 'car'])


class RideRequestCreateSerializer(serializers.Serializer):
    """Création d'une demande de course."""
    pickup_lat = serializers.FloatField(min_value=-90, max_value=90)
    pickup_lng = serializers.FloatField(min_value=-180, max_value=180)
    pickup_address = serializers.CharField(max_length=500, required=False, default='')
    dropoff_lat = serializers.FloatField(min_value=-90, max_value=90)
    dropoff_lng = serializers.FloatField(min_value=-180, max_value=180)
    dropoff_address = serializers.CharField(max_length=500, required=False, default='')
    proposed_price = serializers.IntegerField(min_value=1)
    vehicle_type = serializers.ChoiceField(choices=['moto', 'car'])
    luggage_type = serializers.ChoiceField(choices=['none', 'small', 'suitcase', 'large'], default='none', required=False)
    preferred_driver_id = serializers.UUIDField(required=False, allow_null=True)
    promo_code = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')


class RideOfferCreateSerializer(serializers.Serializer):
    """Chauffeur fait une offre."""
    ride_request_id = serializers.UUIDField()
    offered_price = serializers.IntegerField(min_value=1)


class AcceptOfferSerializer(serializers.Serializer):
    """Passager accepte une offre."""
    offer_id = serializers.UUIDField()


class RideStatusUpdateSerializer(serializers.Serializer):
    """Changement de statut de course."""
    status = serializers.ChoiceField(choices=[
        'driver_en_route', 'driver_arrived',
        'passenger_onboard', 'completed',
    ])


class CancelRideSerializer(serializers.Serializer):
    """Annulation de course."""
    reason = serializers.CharField(max_length=500, required=False, default='')


class RideOfferResponseSerializer(serializers.ModelSerializer):
    """Offre reçue par le passager."""
    driver_name = serializers.SerializerMethodField()
    driver_avatar = serializers.SerializerMethodField()
    driver_vehicle_type = serializers.SerializerMethodField()
    driver_vehicle_info = serializers.SerializerMethodField()
    driver_vehicle_photo = serializers.SerializerMethodField()
    driver_total_rides = serializers.IntegerField(source='driver.total_rides', read_only=True)

    class Meta:
        model = RideOffer
        fields = [
            'id', 'offered_price', 'is_counter_offer',
            'driver_distance_m', 'estimated_arrival_s', 'driver_rating',
            'driver_name', 'driver_avatar', 'driver_vehicle_type', 'driver_vehicle_info',
            'driver_vehicle_photo',
            'driver_total_rides',
            'status', 'expires_at', 'created_at',
        ]

    def get_driver_name(self, obj):
        return f"{obj.driver.user.first_name} {obj.driver.user.last_name[0]}."

    def get_driver_avatar(self, obj):
        return obj.driver.user.avatar_url or ''

    def get_driver_vehicle_type(self, obj):
        return obj.driver.vehicle_type

    def get_driver_vehicle_info(self, obj):
        vehicle = obj.driver.vehicles.filter(is_active=True).first()
        if vehicle:
            return f"{vehicle.brand} {vehicle.model} - {vehicle.color}"
        return ""

    def get_driver_vehicle_photo(self, obj):
        vehicle = obj.driver.vehicles.filter(is_active=True).first()
        return vehicle.photo_url if vehicle else ""


class RideRequestSerializer(serializers.ModelSerializer):
    """Détails d'une demande de course."""
    offers = RideOfferResponseSerializer(many=True, read_only=True)
    offers_count = serializers.SerializerMethodField()

    class Meta:
        model = RideRequest
        fields = [
            'id', 'pickup_address', 'dropoff_address',
            'estimated_distance_m', 'suggested_price', 'proposed_price',
            'vehicle_type', 'luggage_type', 'status', 'notified_count',
            'offers_count', 'offers',
            'expires_at', 'created_at',
        ]

    def get_offers_count(self, obj):
        return obj.offers.filter(status='pending').count()


class RideSerializer(serializers.ModelSerializer):
    """Détails d'une course."""
    driver_name = serializers.SerializerMethodField()
    driver_avatar = serializers.SerializerMethodField()
    driver_phone_masked = serializers.SerializerMethodField()
    driver_rating = serializers.DecimalField(
        source='driver.average_rating', max_digits=3, decimal_places=2, read_only=True
    )
    driver_vehicle = serializers.SerializerMethodField()
    passenger_name = serializers.SerializerMethodField()
    passenger_avatar = serializers.SerializerMethodField()
    passenger_phone = serializers.SerializerMethodField()
    pickup_lat = serializers.SerializerMethodField()
    pickup_lng = serializers.SerializerMethodField()
    dropoff_lat = serializers.SerializerMethodField()
    dropoff_lng = serializers.SerializerMethodField()
    driver_lat = serializers.SerializerMethodField()
    driver_lng = serializers.SerializerMethodField()
    amount_due = serializers.ReadOnlyField()

    class Meta:
        model = Ride
        fields = [
            'id', 'pickup_address', 'dropoff_address',
            'pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng',
            'agreed_price', 'actual_distance_m',
            'promo_code', 'discount_amount', 'amount_due',
            'commission_amount', 'commission_rate',
            'vehicle_type', 'status',
            'driver_name', 'driver_avatar', 'driver_phone_masked', 'driver_rating', 'driver_vehicle',
            'driver_lat', 'driver_lng',
            'passenger_name', 'passenger_avatar', 'passenger_phone',
            'driver_assigned_at', 'driver_en_route_at', 'driver_arrived_at',
            'passenger_onboard_at', 'completed_at', 'paid_at',
            'cancelled_at', 'cancelled_by', 'cancellation_fee',
            'share_token',
            'created_at',
        ]

    def get_pickup_lat(self, obj):
        return obj.pickup_location.y if obj.pickup_location else None

    def get_pickup_lng(self, obj):
        return obj.pickup_location.x if obj.pickup_location else None

    def get_dropoff_lat(self, obj):
        return obj.dropoff_location.y if obj.dropoff_location else None

    def get_dropoff_lng(self, obj):
        return obj.dropoff_location.x if obj.dropoff_location else None

    def get_driver_lat(self, obj):
        loc = obj.driver.current_location
        return loc.y if loc else None

    def get_driver_lng(self, obj):
        loc = obj.driver.current_location
        return loc.x if loc else None

    def get_driver_name(self, obj):
        return f"{obj.driver.user.first_name} {obj.driver.user.last_name[0]}."

    def get_driver_avatar(self, obj):
        return obj.driver.user.avatar_url or ''

    def get_passenger_avatar(self, obj):
        return obj.passenger.avatar_url or ''

    def get_driver_phone_masked(self, obj):
        """Masque le numéro sauf pendant la course active."""
        active_statuses = ['driver_assigned', 'driver_en_route', 'driver_arrived', 'passenger_onboard']
        if obj.status in active_statuses:
            return obj.driver.user.phone
        return '***masqué***'

    def get_driver_vehicle(self, obj):
        vehicle = obj.driver.vehicles.filter(is_active=True).first()
        if vehicle:
            return {
                'type': vehicle.vehicle_type,
                'brand': vehicle.brand,
                'model': vehicle.model,
                'color': vehicle.color,
                'plate': vehicle.plate_number,
                'photo_url': vehicle.photo_url,
            }
        return None

    def get_passenger_name(self, obj):
        return f"{obj.passenger.first_name} {obj.passenger.last_name[0]}."

    def get_passenger_phone(self, obj):
        """Téléphone du passager visible uniquement pendant la course active."""
        active_statuses = ['driver_assigned', 'driver_en_route', 'driver_arrived', 'passenger_onboard']
        if obj.status in active_statuses:
            return obj.passenger.phone
        return None


class RideMessageSerializer(serializers.ModelSerializer):
    """Message de chat d'une course."""
    sender_role = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = RideMessage
        fields = [
            'id', 'text', 'message_key',
            'sender_role', 'sender_name', 'created_at',
        ]

    def get_sender_role(self, obj):
        return 'driver' if obj.sender_id == obj.ride.driver.user_id else 'passenger'

    def get_sender_name(self, obj):
        return obj.sender.first_name


class RideHistorySerializer(serializers.ModelSerializer):
    """Version simplifiée pour l'historique."""
    driver_vehicle = serializers.SerializerMethodField()
    commission_amount = serializers.DecimalField(max_digits=10, decimal_places=0, read_only=True)

    class Meta:
        model = Ride
        fields = [
            'id', 'pickup_address', 'dropoff_address',
            'agreed_price', 'vehicle_type', 'status',
            'commission_amount', 'driver_vehicle',
            'completed_at', 'created_at',
        ]

    def get_driver_vehicle(self, obj):
        if not obj.driver:
            return None
        vehicle = obj.driver.vehicles.filter(is_active=True).first()
        if vehicle:
            return {'type': vehicle.vehicle_type}
        return None
