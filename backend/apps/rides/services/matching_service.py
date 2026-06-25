"""
Service de matching — recherche de chauffeurs et scoring.
Cœur du système de mise en relation.
"""
import logging

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.utils import timezone

from apps.commissions.models import CommissionCredit
from apps.drivers.models import Driver
from apps.rides.models import Ride
from core.config_service import get_config_int

logger = logging.getLogger(__name__)


def find_eligible_drivers(
    pickup_location: Point,
    vehicle_type: str,
    radius_m: int = None,
    max_drivers: int = None,
    exclude_driver_ids: list = None,
) -> list:
    """
    Recherche les chauffeurs éligibles dans un rayon autour du point de départ.

    Critères d'éligibilité (TOUS obligatoires) :
    1. En ligne (is_online=True)
    2. Documents vérifiés (is_verified=True)
    3. Non banni
    4. Bon type de véhicule
    5. Crédit commission suffisant
    6. Pas de course active en cours
    7. Dans le rayon de recherche
    8. Pas en mise hors ligne forcée

    Retourne une liste de dicts triés par score composite.
    """
    if radius_m is None:
        radius_m = get_config_int('default_search_radius_m', 3000)
    if max_drivers is None:
        max_drivers = get_config_int('max_drivers_notified', 10)

    now = timezone.now()
    min_credit = get_config_int('min_credit_for_rides', 200)

    # Requête principale avec filtre géospatial
    drivers = Driver.objects.filter(
        is_online=True,
        is_verified=True,
        user__is_banned=False,
        user__is_active=True,
        vehicle_type=vehicle_type,
        current_location__isnull=False,
        current_location__distance_lte=(pickup_location, D(m=radius_m)),
    ).select_related('user', 'commission_credit')

    # Exclure les chauffeurs en mise hors ligne forcée
    drivers = drivers.exclude(
        forced_offline_until__gt=now
    )

    # Exclure des chauffeurs spécifiques (déjà notifiés, etc.)
    if exclude_driver_ids:
        drivers = drivers.exclude(id__in=exclude_driver_ids)

    # Annoter avec la distance au pickup
    drivers = drivers.annotate(
        distance_to_pickup=Distance('current_location', pickup_location)
    )

    # Filtrer en Python : crédit suffisant + pas de course active
    eligible = []
    active_statuses = ['driver_assigned', 'driver_en_route', 'driver_arrived', 'passenger_onboard']

    for driver in drivers:
        # Vérifier le crédit commission
        try:
            credit = driver.commission_credit
            if credit.balance < min_credit:
                continue
        except CommissionCredit.DoesNotExist:
            continue

        # Vérifier qu'il n'a pas de course active
        has_active_ride = Ride.objects.filter(
            driver=driver,
            status__in=active_statuses
        ).exists()
        if has_active_ride:
            continue

        # Vérifier qu'il n'a pas d'offre pending sur une autre demande
        from apps.rides.models import RideOffer
        has_pending_offer = RideOffer.objects.filter(
            driver=driver,
            status='pending'
        ).exists()
        if has_pending_offer:
            continue

        distance_m = driver.distance_to_pickup.m if driver.distance_to_pickup else 0

        eligible.append({
            'driver': driver,
            'distance_m': int(distance_m),
            'rating': float(driver.average_rating),
            'acceptance_rate': float(driver.acceptance_rate) / 100.0,
        })

    # Scorer et trier
    scored = _score_drivers(eligible, radius_m)

    # Limiter au nombre max
    return scored[:max_drivers]


def _score_drivers(drivers: list, max_radius: int) -> list:
    """
    Calcule un score composite pour chaque chauffeur et trie par score décroissant.

    Score = (0.5 × score_distance) + (0.3 × score_rating) + (0.2 × score_acceptance)
    """
    for d in drivers:
        # Score distance : plus proche = meilleur (1.0 = au même endroit)
        score_distance = max(0, 1.0 - (d['distance_m'] / max_radius))

        # Score rating : meilleure note = meilleur
        score_rating = d['rating'] / 5.0

        # Score acceptance : taux d'acceptation historique
        score_acceptance = d['acceptance_rate']

        d['score'] = (0.5 * score_distance) + (0.3 * score_rating) + (0.2 * score_acceptance)

        # Estimer le temps d'arrivée (vitesse moyenne 20 km/h en ville)
        speed_ms = 20 * 1000 / 3600  # ~5.5 m/s
        d['estimated_arrival_s'] = int(d['distance_m'] / speed_ms) if speed_ms > 0 else 0

    # Trier par score décroissant
    drivers.sort(key=lambda x: x['score'], reverse=True)
    return drivers


def expand_search_radius(current_radius_m: int) -> int:
    """
    Élargit le rayon de recherche d'un palier.
    Retourne le nouveau rayon, ou None si le max est atteint.
    """
    increment = get_config_int('radius_increment_m', 2000)
    max_radius = get_config_int('max_search_radius_m', 10000)

    new_radius = current_radius_m + increment
    if new_radius > max_radius:
        return None
    return new_radius
