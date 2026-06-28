from django.contrib import admin

from .models import Driver, DriverDocument, Vehicle


class DriverDocumentInline(admin.TabularInline):
    model = DriverDocument
    extra = 0
    readonly_fields = ('created_at',)


class VehicleInline(admin.TabularInline):
    model = Vehicle
    extra = 0


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle_type', 'verification_status', 'is_online', 'is_verified', 'average_rating', 'total_rides')
    list_filter = ('verification_status', 'vehicle_type', 'is_online', 'is_verified')
    search_fields = ('user__phone', 'user__first_name', 'user__last_name', 'license_number')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [DriverDocumentInline, VehicleInline]

    actions = ['approve_drivers', 'reject_drivers']

    @admin.action(description="Approuver les chauffeurs sélectionnés")
    def approve_drivers(self, request, queryset):
        queryset.update(verification_status='approved', is_verified=True)

    @admin.action(description="Rejeter les chauffeurs sélectionnés")
    def reject_drivers(self, request, queryset):
        queryset.update(verification_status='rejected', is_verified=False)


@admin.register(DriverDocument)
class DriverDocumentAdmin(admin.ModelAdmin):
    list_display = ('driver', 'doc_type', 'status', 'created_at')
    list_filter = ('doc_type', 'status')


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('driver', 'vehicle_type', 'brand', 'model', 'plate_number', 'is_active')
    list_filter = ('vehicle_type', 'is_active')
    search_fields = ('plate_number', 'brand', 'model')
