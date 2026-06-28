from django.contrib import admin

from .models import Incident


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'incident_type', 'reported_by', 'priority', 'status', 'created_at')
    list_filter = ('incident_type', 'status', 'priority')
    search_fields = ('reported_by__phone', 'description')
    readonly_fields = ('created_at', 'updated_at')
