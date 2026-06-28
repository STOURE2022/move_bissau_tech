from django.contrib import admin

from .models import Payment, PaymentProvider, Refund


@admin.register(PaymentProvider)
class PaymentProviderAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'provider_type', 'is_active', 'min_amount', 'max_amount')
    list_filter = ('provider_type', 'is_active')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'ride', 'amount', 'commission_amount', 'driver_amount', 'payment_method', 'status')
    list_filter = ('status', 'payment_method')
    search_fields = ('passenger__phone', 'provider_tx_id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ('reference', 'passenger', 'amount', 'reason', 'status', 'created_at')
    list_filter = ('status', 'reason')
    search_fields = ('reference', 'passenger__phone')
    readonly_fields = ('reference', 'created_at', 'updated_at')
