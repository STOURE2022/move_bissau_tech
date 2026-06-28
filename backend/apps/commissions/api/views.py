"""Vues API pour la gestion du crédit commission."""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.commissions.models import CreditTransaction, Withdrawal
from apps.commissions.services.commission_service import get_or_create_credit, topup_credit
from apps.commissions.services.withdrawal_service import request_withdrawal
from apps.payments.services.payment_service import PaymentError, get_provider_instance
from core.permissions import IsDriver

from .serializers import (
    CommissionCreditSerializer,
    CreditTransactionSerializer,
    TopupSerializer,
    WithdrawalSerializer,
)


class CreditBalanceView(APIView):
    """GET /api/commissions/balance — Solde du crédit commission."""
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        credit = get_or_create_credit(request.user.driver_profile)
        return Response(CommissionCreditSerializer(credit).data)


class CreditTopupView(APIView):
    """POST /api/commissions/topup — Recharger le crédit commission."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = TopupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        driver = request.user.driver_profile

        # Vérifier si le provider est prêt (actif + clés API)
        from apps.payments.models import PaymentProvider as PP
        try:
            prov = PP.objects.get(name=data['payment_method'], is_active=True)
            provider_ready = bool(prov.api_key_enc)
        except PP.DoesNotExist:
            provider_ready = False

        if not provider_ready:
            # Mode simulation : créditer directement
            import uuid
            tx = topup_credit(
                driver,
                data['amount'],
                provider_name=data['payment_method'],
                provider_tx_id=f"SIM-{uuid.uuid4().hex[:8]}",
            )
            credit = get_or_create_credit(driver)
            return Response({
                'new_balance': credit.balance,
                'transaction': CreditTransactionSerializer(tx).data,
            })

        # Mode réel : initier le paiement mobile money
        try:
            provider = get_provider_instance(data['payment_method'])
        except PaymentError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        reference = f"topup-{driver.id}-{data['amount']}"
        result = provider.initiate_payment(
            amount=data['amount'],
            phone=data['phone'],
            reference=reference,
            description=f"Rechargement crédit MoveBissau - {data['amount']} XOF",
        )

        if not result.success:
            return Response(
                {'error': result.error_message or 'Échec du rechargement.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tx = topup_credit(
            driver,
            data['amount'],
            provider_name=data['payment_method'],
            provider_tx_id=result.transaction_id or '',
        )

        credit = get_or_create_credit(driver)
        return Response({
            'new_balance': credit.balance,
            'transaction': CreditTransactionSerializer(tx).data,
        })


class CreditTransactionsView(APIView):
    """GET /api/commissions/transactions — Historique des transactions."""
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        transactions = CreditTransaction.objects.filter(
            driver=request.user.driver_profile
        ).order_by('-created_at')[:50]

        return Response(CreditTransactionSerializer(transactions, many=True).data)


class WithdrawalRequestView(APIView):
    """POST /api/commissions/withdraw — Demander un retrait."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        amount = request.data.get('amount')
        method = request.data.get('withdrawal_method')
        phone = request.data.get('phone')

        if not all([amount, method, phone]):
            return Response(
                {'error': 'Montant, méthode et téléphone requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            withdrawal = request_withdrawal(
                driver=request.user.driver_profile,
                amount=int(amount),
                method=method,
                phone=phone,
            )
            return Response(WithdrawalSerializer(withdrawal).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class WithdrawalListView(APIView):
    """GET /api/commissions/withdrawals — Historique des retraits du chauffeur."""
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        withdrawals = Withdrawal.objects.filter(
            driver=request.user.driver_profile
        ).order_by('-created_at')[:20]
        return Response(WithdrawalSerializer(withdrawals, many=True).data)
