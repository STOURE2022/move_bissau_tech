from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import OTPCode, User
from .models_promo import PromoCode, PromoUsage, Referral


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('phone', 'first_name', 'last_name', 'role', 'is_active', 'is_banned', 'created_at')
    list_filter = ('role', 'is_active', 'is_banned', 'is_staff', 'phone_verified')
    search_fields = ('phone', 'first_name', 'last_name', 'email')
    ordering = ('-created_at',)

    fieldsets = (
        (None, {'fields': ('phone', 'password')}),
        ('Infos personnelles', {'fields': ('first_name', 'last_name', 'email', 'avatar_url', 'preferred_lang')}),
        ('Rôle & statut', {'fields': ('role', 'phone_verified', 'is_active', 'is_banned', 'ban_reason')}),
        ('Annulations', {'fields': ('cancellation_debt', 'cancellation_debt_created_at')}),
        ('Permissions', {'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('phone', 'role', 'password1', 'password2')}),
    )


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ('phone', 'code', 'purpose', 'is_used', 'attempts', 'expires_at')
    list_filter = ('purpose', 'is_used')
    search_fields = ('phone',)
    readonly_fields = ('id', 'created_at')


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'current_uses', 'max_uses', 'is_active', 'valid_until')
    list_filter = ('discount_type', 'is_active')
    search_fields = ('code', 'description')


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ('referrer', 'referred', 'referral_code', 'referrer_credited', 'referred_credited', 'created_at')
    list_filter = ('referrer_credited', 'referred_credited')
    search_fields = ('referral_code', 'referrer__phone', 'referred__phone')
