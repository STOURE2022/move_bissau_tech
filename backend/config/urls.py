"""URLs racine pour MoveBissau."""
import mimetypes
import os

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, JsonResponse
from django.urls import include, path, re_path
from django.views.generic import TemplateView

from apps.admin_dashboard.api.views import PublicCountryConfigView


def health_check(request):
    return JsonResponse({'status': 'ok'})


def serve_admin_spa(request, path=''):
    """Sert le dashboard admin React (SPA) depuis admin_dist/.

    - Si le path correspond à un fichier réel (JS, CSS, images), le sert directement
    - Sinon, sert index.html pour le routing client-side React
    """
    admin_dist = os.path.join(settings.BASE_DIR, 'admin_dist')

    # Essayer de servir un fichier réel (assets, images, etc.)
    if path:
        file_path = os.path.join(admin_dist, path)
        if os.path.isfile(file_path):
            content_type, _ = mimetypes.guess_type(file_path)
            return FileResponse(open(file_path, 'rb'), content_type=content_type or 'application/octet-stream')

    # Sinon, servir index.html (SPA routing)
    index_path = os.path.join(admin_dist, 'index.html')
    if os.path.isfile(index_path):
        return FileResponse(open(index_path, 'rb'), content_type='text/html')

    return JsonResponse({'error': 'Admin dashboard not built'}, status=404)


urlpatterns = [
    # Health check (léger, pas d'auth, pas de DB)
    path('healthz', health_check, name='health-check'),

    # Django Admin (fallback)
    path('django-admin/', admin.site.urls),

    # Dashboard admin React (SPA) — sert fichiers + fallback index.html
    path('admin/', serve_admin_spa, name='admin-dashboard'),
    re_path(r'^admin/(?P<path>.+)$', serve_admin_spa),

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

# Servir les fichiers media (photos, documents) — fonctionne même avec DEBUG=False
def serve_media(request, path=''):
    """Sert les fichiers média depuis MEDIA_ROOT (avatars, documents, etc.)."""
    file_path = os.path.join(str(settings.MEDIA_ROOT), path)
    if os.path.isfile(file_path):
        content_type, _ = mimetypes.guess_type(file_path)
        return FileResponse(open(file_path, 'rb'), content_type=content_type or 'application/octet-stream')
    from django.http import Http404
    raise Http404

urlpatterns += [
    re_path(r'^media/(?P<path>.+)$', serve_media, name='serve-media'),
]

# Catch-all : toutes les routes non-API servent le frontend passager React (SPA)
# Doit être en DERNIER pour ne pas bloquer les routes API/admin
urlpatterns += [
    re_path(r'^(?!api/|django-admin/|admin/|healthz|static/|media/).*$',
            TemplateView.as_view(template_name='index.html'),
            name='frontend'),
]
