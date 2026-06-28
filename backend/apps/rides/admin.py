from django.contrib import admin

from .models import Ride, RideOffer, RideRequest


@admin.register(RideRequest)
class RideRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'passenger', 'proposed_price', 'vehicle_type', 'status', 'created_at')
    list_filter = ('status', 'vehicle_type')
    search_fields = ('passenger__phone', 'passenger__first_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(RideOffer)
class RideOfferAdmin(admin.ModelAdmin):
    list_display = ('id', 'ride_request', 'driver', 'offered_price', 'is_counter_offer', 'status')
    list_filter = ('status', 'is_counter_offer')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = ('id', 'passenger', 'driver', 'agreed_price', 'vehicle_type', 'status', 'created_at')
    list_filter = ('status', 'vehicle_type', 'cancelled_by')
    search_fields = ('passenger__phone', 'driver__user__phone')
    readonly_fields = ('created_at', 'updated_at', 'share_token')
