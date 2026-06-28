"""Vues API pour les paiements."""
import logging

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.services.payment_service import (
    PaymentError,
    confirm_cash_payment,
    get_active_providers,
    handle_payment_callback,
    initiate_mobile_payment,
)
from apps.rides.models import Ride
from core.permissions import IsDriver, IsPassenger

from .serializers import (
    ConfirmCashSerializer,
    InitiatePaymentSerializer,
    PaymentSerializer,
)

logger = logging.getLogger(__name__)


class InitiatePaymentView(APIView):
    """POST /api/payments/initiate — Initier un paiement mobile money."""
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = InitiatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            ride = Ride.objects.get(
                id=data['ride_id'],
                passenger=request.user,
                status='completed'
            )
        except Ride.DoesNotExist:
            return Response(
                {'error': 'Course introuvable ou pas encore terminée.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Vérifier si le provider est configuré avec de vraies clés API
        from apps.payments.models import PaymentProvider as PP
        try:
            provider = PP.objects.get(name=data['payment_method'], is_active=True)
            provider_ready = bool(provider.api_key_enc)
        except PP.DoesNotExist:
            provider_ready = False

        if not provider_ready:
            # Provider non configuré ou sans clés API → simuler un paiement réussi
            logger.info(f"Paiement simulé (provider {data['payment_method']} non prêt)")
            payment = confirm_cash_payment(ride)
            return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

        try:
            payment = initiate_mobile_payment(
                ride, data['payment_method'], data['phone']
            )
        except PaymentError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class ConfirmCashPaymentView(APIView):
    """POST /api/payments/confirm-cash — Le chauffeur confirme le paiement cash."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = ConfirmCashSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            ride = Ride.objects.get(
                id=serializer.validated_data['ride_id'],
                driver=request.user.driver_profile,
                status='completed'
            )
        except Ride.DoesNotExist:
            return Response(
                {'error': 'Course introuvable ou pas encore terminée.'},
                status=status.HTTP_404_NOT_FOUND
            )

        payment = confirm_cash_payment(ride)
        return Response(PaymentSerializer(payment).data)


class PaymentCallbackView(APIView):
    """POST /api/payments/callback/<provider> — Webhook callback du provider."""
    permission_classes = [AllowAny]  # Callback provenant du provider

    def post(self, request, provider_name):
        try:
            payment = handle_payment_callback(provider_name, request.data)
            return Response({'status': payment.status})
        except PaymentError as e:
            logger.error(f"Erreur callback {provider_name}: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class ActiveProvidersView(APIView):
    """GET /api/payments/providers — Liste des providers de paiement actifs."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        providers = get_active_providers()
        return Response(providers)
