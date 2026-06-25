"""Serializers pour les commissions."""
from rest_framework import serializers

from apps.commissions.models import CommissionCredit, CreditTransaction, Withdrawal


class CommissionCreditSerializer(serializers.ModelSerializer):
    has_sufficient_credit = serializers.BooleanField(read_only=True)

    class Meta:
        model = CommissionCredit
        fields = [
            'balance', 'total_topups', 'total_commissions',
            'has_sufficient_credit', 'updated_at',
        ]


class CreditTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditTransaction
        fields = [
            'id', 'tx_type', 'amount', 'balance_before', 'balance_after',
            'description', 'provider_name', 'created_at',
        ]


class TopupSerializer(serializers.Serializer):
    """Rechargement du crédit commission."""
    amount = serializers.IntegerField(min_value=500, max_value=50000)
    payment_method = serializers.ChoiceField(choices=['orange_money', 'moov_money'])
    phone = serializers.CharField(max_length=20)


class WithdrawalSerializer(serializers.ModelSerializer):
    """Serializer retrait pour le chauffeur."""
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = Withdrawal
        fields = [
            'id', 'reference', 'amount', 'status', 'status_display',
            'withdrawal_method', 'phone',
            'admin_note', 'processed_at', 'created_at',
        ]

    def get_status_display(self, obj):
        labels = {
            'pending': 'En attente',
            'approved': 'Approuvé',
            'processing': 'En cours',
            'completed': 'Effectué',
            'rejected': 'Rejeté',
        }
        return labels.get(obj.status, obj.status)
