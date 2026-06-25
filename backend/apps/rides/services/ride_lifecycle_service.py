"""
Service de cycle de vie des courses.
Gère toutes les transitions de statut et les annulations.
"""
import logging

from django.db import transaction
from django.utils import timezone

from apps.commissions.services.commission_service import deduct_commission, deduct_cancellation_fee
from apps.incidents.models import Incident
from apps.rides.models import Ride, RideOffer, RideRequest
from core.config_service import get_config_int

logger = logging.getLogger(__name__)


class RideLifecycleError(Exception):
    """Erreur dans le cycle de vie d'une course."""
    pass


def accept_offer(ride_request: RideRequest, offer: RideOffer) -> Ride:
    """
    Le passager accepte une offre. Crée la course et rejette les autres offres.
    """
    if ride_request.status not in ('pending', 'offers_received'):
        raise RideLifecycleError("Cette demande n'est plus active.")

    if offer.status != 'pending':
        raise RideLifecycleError("Cette offre n'est plus disponible.")

    if offer.ride_request_id != ride_request.id:
        raise RideLifecycleError("Cette offre ne correspond pas à cette demande.")

    with transaction.atomic():
        # Mettre à jour le statut de la demande
        ride_request.status = 'accepted'
        ride_request.save(update_fields=['status', 'updated_at'])

        # Accepter cette offre
        offer.status = 'accepted'
        offer.save(update_fields=['status', 'updated_at'])

        # Rejeter toutes les autres offres
        RideOffer.objects.filter(
            ride_request=ride_request
        ).exclude(
            id=offer.id
        ).update(status='rejected', updated_at=timezone.now())

        # Calculer la commission
        from core.config_service import get_config_float
        commission_rate = get_config_float('commission_rate', 15.0)
        commission_amount = int(
            offer.offered_price * commission_rate / 100 + 0.99  # Arrondi supérieur
        )

        # Créer la course
        ride = Ride.objects.create(
            ride_request=ride_request,
            ride_offer=offer,
            passenger=ride_request.passenger,
            driver=offer.driver,
            pickup_location=ride_request.pickup_location,
            pickup_address=ride_request.pickup_address,
            dropoff_location=ride_request.dropoff_location,
            dropoff_address=ride_request.dropoff_address,
            agreed_price=offer.offered_price,
            commission_amount=commission_amount,
            commission_rate=commission_rate,
            vehicle_type=ride_request.vehicle_type,
            status='driver_assigned',
        )

        logger.info(
            f"Course #{str(ride.id)[:8]} créée : "
            f"{ride.agreed_price} XOF, commission {commission_amount} XOF"
        )

    return ride


def update_ride_status(ride: Ride, new_status: str, user=None) -> Ride:
    """
    Met à jour le statut d'une course.
    Vérifie que la transition est autorisée.
    """
    if not ride.can_transition_to(new_status):
        raise RideLifecycleError(
            f"Transition interdite : {ride.status} → {new_status}"
        )

    now = timezone.now()

    with transaction.atomic():
        ride.status = new_status

        # Mettre à jour le timestamp correspondant
        timestamp_map = {
            'driver_en_route': 'driver_en_route_at',
            'driver_arrived': 'driver_arrived_at',
            'passenger_onboard': 'passenger_onboard_at',
            'completed': 'completed_at',
            'paid': 'paid_at',
        }

        if new_status in timestamp_map:
            setattr(ride, timestamp_map[new_status], now)

        ride.save()

        logger.info(f"Course #{str(ride.id)[:8]} : statut → {new_status}")

    return ride


def cancel_ride(ride: Ride, cancelled_by: str, reason: str = '') -> Ride:
    """
    Annule une course. Applique les frais d'annulation si applicable.

    cancelled_by : 'passenger', 'driver', 'system'
    """
    if not ride.can_transition_to('cancelled'):
        raise RideLifecycleError(
            f"Impossible d'annuler une course au statut '{ride.status}'"
        )

    cancellation_fee = get_config_int('cancellation_fee', 500)
    now = timezone.now()

    with transaction.atomic():
        ride.status = 'cancelled'
        ride.cancelled_at = now
        ride.cancelled_by = cancelled_by
        ride.cancellation_reason = reason

        # Déterminer si des frais s'appliquent
        # Pas de frais si la course n'a pas encore été assignée
        if ride.status in ('driver_assigned', 'driver_en_route', 'driver_arrived', 'passenger_onboard'):
            ride.cancellation_fee = cancellation_fee

            if cancelled_by == 'driver':
                # Déduire les frais du crédit du chauffeur
                deduct_cancellation_fee(ride.driver, cancellation_fee, ride)

                # Incrémenter le compteur d'annulations du chauffeur
                driver = ride.driver
                driver.cancellations_today += 1
                max_cancellations = get_config_int('driver_max_cancellations_24h', 3)
                if driver.cancellations_today >= max_cancellations:
                    cooldown = get_config_int('driver_cooldown_minutes', 60)
                    driver.forced_offline_until = now + timezone.timedelta(minutes=cooldown)
                    driver.is_online = False
                    logger.warning(
                        f"Chauffeur {driver.id} mis hors ligne pour {cooldown} min "
                        f"({driver.cancellations_today} annulations)"
                    )
                driver.save()

            elif cancelled_by == 'passenger':
                # Enregistrer la dette d'annulation sur le passager
                passenger = ride.passenger
                passenger.cancellation_debt += cancellation_fee
                if not passenger.cancellation_debt_created_at:
                    passenger.cancellation_debt_created_at = now
                passenger.save(update_fields=[
                    'cancellation_debt', 'cancellation_debt_created_at'
                ])

        ride.save()

        # Remettre le chauffeur disponible
        driver = ride.driver
        if cancelled_by != 'driver' or ride.cancellation_fee == 0:
            # Le chauffeur redevient disponible sauf s'il a été mis hors ligne
            pass

        # Si annulation pendant course en cours, ouvrir un incident automatiquement
        if ride.passenger_onboard_at is not None:
            Incident.objects.create(
                ride=ride,
                reported_by=ride.passenger,
                incident_type='dispute',
                description=f"Annulation pendant la course par {cancelled_by}. Raison : {reason}",
                priority='high',
            )

        logger.info(
            f"Course #{str(ride.id)[:8]} annulée par {cancelled_by}, "
            f"frais : {ride.cancellation_fee} XOF"
        )

    return ride


def handle_noshow(ride: Ride, noshow_by: str) -> Ride:
    """
    Gère un no-show (passager ou chauffeur).

    noshow_by : 'passenger' (le passager ne se montre pas)
                'driver' (le chauffeur ne se montre pas)
    """
    cancellation_fee = get_config_int('cancellation_fee', 500)

    if noshow_by == 'passenger':
        # Le chauffeur est arrivé, le passager n'est pas là après le timeout
        return cancel_ride(
            ride,
            cancelled_by='passenger',
            reason="No-show passager : absence au point de rendez-vous"
        )
    elif noshow_by == 'driver':
        # Le chauffeur ne s'est pas présenté
        ride = cancel_ride(
            ride,
            cancelled_by='driver',
            reason="No-show chauffeur : non arrivé au point de rendez-vous"
        )
        # Le passager ne paie pas dans ce cas
        ride.cancellation_fee = 0
        ride.passenger.cancellation_debt = max(
            0, ride.passenger.cancellation_debt - cancellation_fee
        )
        ride.passenger.save(update_fields=['cancellation_debt'])
        ride.save(update_fields=['cancellation_fee'])
        return ride
