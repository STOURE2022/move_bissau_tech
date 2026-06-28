from django.contrib import admin

from .models import SmsProvider, SystemConfig


@admin.register(SystemConfig)
class SystemConfigAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'category', 'updated_at')
    list_filter = ('category',)
    search_fields = ('key', 'description')


@admin.register(SmsProvider)
class SmsProviderAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'name', 'is_active', 'is_primary', 'sender_id')
    list_filter = ('is_active', 'is_primary')
