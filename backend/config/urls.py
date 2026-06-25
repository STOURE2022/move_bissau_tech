"""URLs racine pour MoveBissau."""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from apps.admin_dashboard.api.views import PublicCountryConfigView

urlpatterns = [
    # Admin Django (pour debug, le vrai admin est le dashboard React)
    path('django-admin/', admin.site.urls),

    # Config publique (pas d'auth)
    path('api/config/country', PublicCountryConfigView.as_view(), name='public-country-config'),

    # API v1
    path('api/auth/', include('apps.accounts.api.urls')),
    path('api/drivers/', include('apps.drivers.api.urls')),
    path('api/rides/', include('apps.rides.api.urls')),
    path('api/payments/', include('apps.payments.api.urls')),
    path('api/commissions/', include('apps.commissions.api.urls')),
    path('api/ratings/', include('apps.ratings.api.urls')),
    path('api/incidents/', include('apps.incidents.api.urls')),

    # API admin dashboard
    path('api/admin/', include('apps.admin_dashboard.api.urls')),
]

# Servir les fichiers media en dev (photos, documents)
if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
