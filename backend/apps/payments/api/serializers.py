"""Serializers pour les paiements."""
from rest_framework import serializers

from apps.payments.models import Payment, PaymentProvider


class InitiatePaymentSerializer(serializers.Serializer):
    """Initier un paiement mobile money."""
    ride_id = serializers.UUIDField()
    payment_method = serializers.ChoiceField(choices=['orange_money', 'moov_money'])
    phone = serializers.CharField(max_length=20)


class ConfirmCashSerializer(serializers.Serializer):
    """Confirmer un paiement cash."""
    ride_id = serializers.UUIDField()


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'ride_id', 'amount', 'commission_amount',
            'driver_amount', 'payment_method', 'status',
            'created_at',
        ]


class PaymentProviderSerializer(serializers.ModelSerializer):
    """Provider de paiement (vue publique, sans secrets)."""
    class Meta:
        model = PaymentProvider
        fields = ['name', 'display_name', 'provider_type', 'is_active']
