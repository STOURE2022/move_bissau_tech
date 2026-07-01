"""
Tâches Celery pour les courses.
- Notification des chauffeurs
- Notification des passagers
- Expiration des demandes et offres
- Élargissement du rayon de recherche
"""
import logging

from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from apps.rides.models import RideOffer, RideRequest

logger = logging.getLogger(__name__)


@shared_task
def notify_drivers_of_request(ride_request_id: str, driver_ids: list):
    """
    Notifie les chauffeurs éligibles d'une nouvelle demande de course.
    Envoie via WebSocket à chaque chauffeur.
    """
    try:
        ride_request = RideRequest.objects.select_related('passenger').get(id=ride_request_id)
    except RideRequest.DoesNotExist:
        logger.error(f"Demande {ride_request_id} introuvable")
        return

    if ride_request.status not in ('pending', 'offers_received'):
        return

    channel_layer = get_channel_layer()
    request_data = {
        'id': str(ride_request.id),
        'pickup_address': ride_request.pickup_address,
        'dropoff_address': ride_request.dropoff_address,
        'proposed_price': ride_request.proposed_price,
        'suggested_price': ride_request.suggested_price,
        'vehicle_type': ride_request.vehicle_type,
        'estimated_distance_m': ride_request.estimated_distance_m,
        'passenger_name': f"{ride_request.passenger.first_name} {ride_request.passenger.last_name[0]}.",
        'expires_at': ride_request.expires_at.isoformat(),
    }

    for driver_id in driver_ids:
        group_name = f'driver_requests_{driver_id}'
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'new_ride_request',
                'ride_request': request_data,
            }
        )

    logger.info(
        f"Demande #{ride_request_id[:8]} notifiée à {len(driver_ids)} chauffeurs"
    )


@shared_task
def notify_passenger_of_offer(ride_request_id: str, offer_id: str):
    """Notifie le passager d'une nouvelle offre via WebSocket."""
    try:
        offer = RideOffer.objects.select_related(
            'driver', 'driver__user'
        ).get(id=offer_id)
    except RideOffer.DoesNotExist:
        return

    channel_layer = get_channel_layer()
    group_name = f'ride_offers_{ride_request_id}'

    from apps.rides.api.serializers import RideOfferResponseSerializer
    offer_data = RideOfferResponseSerializer(offer).data

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'new_offer',
            'offer': offer_data,
        }
    )


@shared_task
def notify_offer_accepted(ride_id: str, losing_driver_ids: list):
    """
    Notifie les chauffeurs du résultat de l'acceptation d'une offre.
    - Le chauffeur gagnant reçoit la course complète (offer_accepted).
    - Les chauffeurs perdants sont informés que leur offre est rejetée.
    """
    from apps.rides.models import Ride
    try:
        ride = Ride.objects.select_related(
            'driver', 'driver__user', 'passenger', 'ride_request'
        ).get(id=ride_id)
    except Ride.DoesNotExist:
        logger.error(f"Course {ride_id} introuvable pour notification d'acceptation")
        return

    channel_layer = get_channel_layer()

    from apps.rides.api.serializers import RideSerializer
    ride_data = RideSerializer(ride).data

    # Chauffeur gagnant
    async_to_sync(channel_layer.group_send)(
        f'driver_requests_{ride.driver_id}',
        {
            'type': 'offer_accepted',
            'ride': ride_data,
        }
    )

    # Chauffeurs perdants
    request_id = str(ride.ride_request_id)
    for driver_id in losing_driver_ids:
        async_to_sync(channel_layer.group_send)(
            f'driver_requests_{driver_id}',
            {
                'type': 'offer_rejected',
                'ride_request_id': request_id,
            }
        )

    logger.info(
        f"Course #{ride_id[:8]} : chauffeur {ride.driver_id} notifié de l'acceptation, "
        f"{len(losing_driver_ids)} perdant(s) notifié(s)"
    )


@shared_task
def notify_offer_rejected(driver_id: str, ride_request_id: str):
    """Notifie un chauffeur que son offre a été rejetée par le passager."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'driver_requests_{driver_id}',
        {
            'type': 'offer_rejected',
            'ride_request_id': ride_request_id,
        }
    )


@shared_task
def notify_request_cancelled(ride_request_id: str, driver_ids: list):
    """Notifie les chauffeurs ayant une offre en cours que la demande est annulée."""
    channel_layer = get_channel_layer()
    for driver_id in driver_ids:
        async_to_sync(channel_layer.group_send)(
            f'driver_requests_{driver_id}',
            {
                'type': 'request_cancelled',
                'ride_request_id': ride_request_id,
            }
        )

    if driver_ids:
        logger.info(
            f"Demande #{ride_request_id[:8]} annulée : {len(driver_ids)} chauffeur(s) notifié(s)"
        )


@shared_task
def notify_ride_status_change(ride_id: str):
    """Notifie du changement de statut d'une course via WebSocket."""
    from apps.rides.models import Ride
    try:
        ride = Ride.objects.get(id=ride_id)
    except Ride.DoesNotExist:
        return

    channel_layer = get_channel_layer()
    group_name = f'ride_tracking_{ride_id}'

    from apps.rides.api.serializers import RideSerializer
    ride_data = RideSerializer(ride).data

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'ride_status_changed',
            'status': ride.status,
            'ride': ride_data,
        }
    )


@shared_task
def expire_ride_requests():
    """
    Tâche périodique : expire les demandes de course dont le TTL est dépassé.
    Exécutée toutes les 30 secondes via Celery Beat.
    """
    from django.utils import timezone

    now = timezone.now()
    expired = RideRequest.objects.filter(
        status__in=['pending', 'offers_received'],
        expires_at__lt=now,
    )

    count = 0
    for request in expired:
        request.status = 'expired'
        request.save(update_fields=['status', 'updated_at'])

        # Expirer toutes les offres associées
        RideOffer.objects.filter(
            ride_request=request, status='pending'
        ).update(status='expired')

        count += 1

    if count > 0:
        logger.info(f"{count} demande(s) de course expirée(s)")


@shared_task
def expire_ride_offers():
    """
    Tâche périodique : expire les offres dont le TTL est dépassé.
    Exécutée toutes les 30 secondes via Celery Beat.
    """
    from django.utils import timezone

    now = timezone.now()
    expired_count = RideOffer.objects.filter(
        status='pending',
        expires_at__lt=now,
    ).update(status='expired')

    if expired_count > 0:
        logger.info(f"{expired_count} offre(s) expirée(s)")


@shared_task
def expand_search_for_request(ride_request_id: str):
    """
    Élargit le rayon de recherche si aucun chauffeur n'a répondu.
    Appelé 30 secondes après la création de la demande.
    """
    try:
        ride_request = RideRequest.objects.get(id=ride_request_id)
    except RideRequest.DoesNotExist:
        return

    if ride_request.status != 'pending':
        return  # Déjà des offres ou annulée

    from apps.rides.services.matching_service import expand_search_radius, find_eligible_drivers

    new_radius = expand_search_radius(ride_request.search_radius_m)
    if new_radius is None:
        logger.info(f"Demande #{ride_request_id[:8]} : rayon max atteint, pas d'élargissement")
        return

    # Trouver les chauffeurs dans le nouveau rayon (exclure ceux déjà notifiés)
    already_notified = list(
        RideOffer.objects.filter(
            ride_request=ride_request
        ).values_list('driver_id', flat=True)
    )

    eligible = find_eligible_drivers(
        pickup_location=ride_request.pickup_location,
        vehicle_type=ride_request.vehicle_type,
        radius_m=new_radius,
        exclude_driver_ids=already_notified,
    )

    if eligible:
        ride_request.search_radius_m = new_radius
        ride_request.notified_count += len(eligible)
        ride_request.save(update_fields=['search_radius_m', 'notified_count'])

        notify_drivers_of_request.delay(
            str(ride_request.id),
            [str(d['driver'].id) for d in eligible]
        )

        logger.info(
            f"Demande #{ride_request_id[:8]} : rayon élargi à {new_radius}m, "
            f"{len(eligible)} nouveaux chauffeurs notifiés"
        )

    # Planifier un prochain élargissement dans 30 secondes
    expand_search_for_request.apply_async(
        args=[ride_request_id],
        countdown=30,
    )


@shared_task
def reset_driver_cancellations():
    """
    Tâche quotidienne : remet à zéro le compteur d'annulations des chauffeurs.
    Exécutée à minuit via Celery Beat.
    """
    from apps.drivers.models import Driver
    count = Driver.objects.filter(cancellations_today__gt=0).update(
        cancellations_today=0
    )
    if count > 0:
        logger.info(f"Compteur d'annulations remis à zéro pour {count} chauffeur(s)")


@shared_task
def cleanup_expired_cancellation_debts():
    """
    Tâche quotidienne : annule les dettes d'annulation expirées (30 jours).
    Conformité halal : la dette ne croît jamais et est annulée après 30 jours.
    """
    from django.utils import timezone
    from apps.accounts.models import User
    from core.config_service import get_config_int

    expiry_days = get_config_int('cancellation_debt_expiry_days', 30)
    cutoff = timezone.now() - timezone.timedelta(days=expiry_days)

    count = User.objects.filter(
        cancellation_debt__gt=0,
        cancellation_debt_created_at__lt=cutoff,
    ).update(
        cancellation_debt=0,
        cancellation_debt_created_at=None,
    )

    if count > 0:
        logger.info(f"{count} dette(s) d'annulation expirée(s) annulée(s)")
