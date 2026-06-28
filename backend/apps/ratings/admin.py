from django.contrib import admin

from .models import Rating


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ('ride', 'from_user', 'to_user', 'role', 'score', 'created_at')
    list_filter = ('role', 'score')
    search_fields = ('from_user__phone', 'to_user__phone')
    readonly_fields = ('created_at',)
