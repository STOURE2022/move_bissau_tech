"""Routes WebSocket pour MoveBissau."""
from django.urls import re_path

from apps.rides.consumers import (
    DriverLocationConsumer,
    DriverRequestsConsumer,
    RideOffersConsumer,
    RideTrackingConsumer,
)

websocket_urlpatterns = [
    # Chauffeur : envoie sa position GPS en continu
    re_path(r'ws/driver/location/$', DriverLocationConsumer.as_asgi()),

    # Chauffeur : reçoit les nouvelles demandes de course
    re_path(r'ws/driver/requests/$', DriverRequestsConsumer.as_asgi()),

    # Passager : reçoit les offres pour sa demande
    re_path(r'ws/rides/(?P<request_id>[0-9a-f-]+)/offers/$', RideOffersConsumer.as_asgi()),

    # Suivi GPS d'une course en cours (passager + lien partagé)
    re_path(r'ws/rides/(?P<ride_id>[0-9a-f-]+)/tracking/$', RideTrackingConsumer.as_asgi()),
]
