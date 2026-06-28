from django.contrib import admin

from .models import CommissionCredit, CreditTransaction, Withdrawal


@admin.register(CommissionCredit)
class CommissionCreditAdmin(admin.ModelAdmin):
    list_display = ('driver', 'balance', 'total_topups', 'total_commissions')
    search_fields = ('driver__user__phone', 'driver__user__first_name')


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display = ('driver', 'tx_type', 'amount', 'balance_before', 'balance_after', 'created_at')
    list_filter = ('tx_type',)
    search_fields = ('driver__user__phone', 'provider_tx_id')
    readonly_fields = ('created_at',)


@admin.register(Withdrawal)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = ('reference', 'driver', 'amount', 'withdrawal_method', 'phone', 'status', 'created_at')
    list_filter = ('status', 'withdrawal_method')
    search_fields = ('reference', 'driver__user__phone', 'phone')
    readonly_fields = ('reference', 'created_at', 'updated_at')
