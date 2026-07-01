"""
WebSocket consumers pour le temps réel.
- Position GPS du chauffeur
- Réception des demandes de course par le chauffeur
- Réception des offres par le passager
- Suivi GPS d'une course en cours
"""
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.gis.geos import Point
from django.utils import timezone

logger = logging.getLogger(__name__)


class DriverLocationConsumer(AsyncJsonWebsocketConsumer):
    """
    WS /ws/driver/location/
    Le chauffeur envoie sa position GPS toutes les 5 secondes.
    Le serveur diffuse la position aux passagers qui suivent ce chauffeur.
    """

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.driver_id = await self._get_driver_id(user)
        if not self.driver_id:
            await self.close()
            return

        # Rejoindre le groupe du chauffeur
        self.group_name = f'driver_location_{self.driver_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"Chauffeur {self.driver_id} connecté (location)")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        """Reçoit la position GPS du chauffeur."""
        lat = content.get('latitude')
        lng = content.get('longitude')
        heading = content.get('heading', 0)
        speed = content.get('speed', 0)

        if lat is None or lng is None:
            return

        # Sauvegarder en base
        await self._update_driver_location(lat, lng)

        # Diffuser la position aux abonnés (passagers suivant ce chauffeur)
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'location_update',
                'latitude': lat,
                'longitude': lng,
                'heading': heading,
                'speed': speed,
                'timestamp': timezone.now().isoformat(),
            }
        )

    async def location_update(self, event):
        """Envoie la mise à jour de position au client."""
        await self.send_json(event)

    @database_sync_to_async
    def _get_driver_id(self, user):
        try:
            return str(user.driver_profile.id)
        except Exception:
            return None

    @database_sync_to_async
    def _update_driver_location(self, lat, lng):
        from apps.drivers.models import Driver
        Driver.objects.filter(id=self.driver_id).update(
            current_location=Point(lng, lat, srid=4326),
            location_updated_at=timezone.now(),
        )


class DriverRequestsConsumer(AsyncJsonWebsocketConsumer):
    """
    WS /ws/driver/requests/
    Le chauffeur reçoit les nouvelles demandes de course dans son rayon.
    """

    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.driver_id = await self._get_driver_id(user)
        if not self.driver_id:
            await self.close()
            return

        # Chaque chauffeur a son propre groupe pour recevoir les demandes
        self.group_name = f'driver_requests_{self.driver_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"Chauffeur {self.driver_id} connecté (requests)")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def new_ride_request(self, event):
        """Envoie une nouvelle demande de course au chauffeur."""
        await self.send_json({
            'type': 'new_ride_request',
            'ride_request': event['ride_request'],
        })

    async def offer_accepted(self, event):
        """Le passager a accepté l'offre de ce chauffeur : la course démarre."""
        await self.send_json({
            'type': 'offer_accepted',
            'ride': event['ride'],
        })

    async def offer_rejected(self, event):
        """L'offre de ce chauffeur a été rejetée (autre offre choisie ou refus)."""
        await self.send_json({
            'type': 'offer_rejected',
            'ride_request_id': event['ride_request_id'],
        })

    async def request_cancelled(self, event):
        """La demande sur laquelle ce chauffeur avait une offre a été annulée."""
        await self.send_json({
            'type': 'request_cancelled',
            'ride_request_id': event['ride_request_id'],
        })

    @database_sync_to_async
    def _get_driver_id(self, user):
        try:
            return str(user.driver_profile.id)
        except Exception:
            return None


class RideOffersConsumer(AsyncJsonWebsocketConsumer):
    """
    WS /ws/rides/<request_id>/offers/
    Le passager reçoit les offres des chauffeurs en temps réel.
    """

    async def connect(self):
        self.request_id = self.scope['url_route']['kwargs']['request_id']
        self.group_name = f'ride_offers_{self.request_id}'

        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close()
            return

        # Vérifier que le passager est bien le propriétaire de la demande
        is_owner = await self._is_request_owner(user, self.request_id)
        if not is_owner:
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"Passager connecté pour offres de la demande {self.request_id}")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def new_offer(self, event):
        """Envoie une nouvelle offre au passager."""
        await self.send_json({
            'type': 'new_offer',
            'offer': event['offer'],
        })

    async def offer_withdrawn(self, event):
        """Notifie le passager qu'une offre a été retirée."""
        await self.send_json({
            'type': 'offer_withdrawn',
            'offer_id': event['offer_id'],
        })

    @database_sync_to_async
    def _is_request_owner(self, user, request_id):
        from apps.rides.models import RideRequest
        return RideRequest.objects.filter(id=request_id, passenger=user).exists()


class RideTrackingConsumer(AsyncJsonWebsocketConsumer):
    """
    WS /ws/rides/<ride_id>/tracking/
    Suivi GPS d'une course en cours.
    Le passager (ou un lien partagé) reçoit la position du chauffeur
    et les changements de statut.
    """

    async def connect(self):
        self.ride_id = self.scope['url_route']['kwargs']['ride_id']
        self.group_name = f'ride_tracking_{self.ride_id}'

        # Rejoindre le groupe (la vérification d'accès est faite à la demande)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"Client connecté pour suivi course {self.ride_id}")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def driver_location(self, event):
        """Position GPS du chauffeur mise à jour."""
        await self.send_json({
            'type': 'driver_location',
            'latitude': event['latitude'],
            'longitude': event['longitude'],
            'heading': event.get('heading', 0),
            'speed': event.get('speed', 0),
            'timestamp': event.get('timestamp'),
        })

    async def ride_status_changed(self, event):
        """Changement de statut de la course."""
        await self.send_json({
            'type': 'ride_status_changed',
            'status': event['status'],
            'ride': event.get('ride'),
        })
