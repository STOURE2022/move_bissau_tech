"""
Service de calcul de prix — prix indicatif, plancher, plafond.
Toutes les valeurs sont lues depuis system_config (configurables admin).
"""
import logging
import math

from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D

from core.config_service import get_config_float, get_config_int

logger = logging.getLogger(__name__)


def calculate_distance_m(pickup: Point, dropoff: Point) -> int:
    """
    Calcule la distance en mètres entre deux points GPS.
    Utilise la distance géodésique (sphérique) via PostGIS.
    On applique un facteur de 1.3 pour approximer la distance route.
    """
    # Distance à vol d'oiseau en mètres
    direct_distance = pickup.distance(dropoff) * 100_000  # degrés → mètres approx
    # Facteur de correction route (les routes ne sont pas en ligne droite)
    route_factor = 1.3
    return int(direct_distance * route_factor)


def calculate_distance_geodesic(pickup: Point, dropoff: Point) -> int:
    """
    Calcule la distance géodésique précise en mètres.
    Utilise la formule haversine via les coordonnées GPS.
    """
    from math import asin, cos, radians, sin, sqrt

    lat1, lon1 = radians(pickup.y), radians(pickup.x)
    lat2, lon2 = radians(dropoff.y), radians(dropoff.x)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))

    # Rayon de la Terre en mètres
    r = 6_371_000
    direct_distance = int(c * r)

    # Facteur de correction route
    return int(direct_distance * 1.3)


def calculate_suggested_price(distance_m: int, vehicle_type: str) -> int:
    """
    Calcule le prix indicatif basé sur la distance.
    Formule : base_price + (distance_km × price_per_km)
    """
    distance_km = distance_m / 1000.0

    if vehicle_type == 'moto':
        base = get_config_int('base_price_moto', 200)
        per_km = get_config_int('price_per_km_moto', 150)
    else:
        base = get_config_int('base_price_car', 500)
        per_km = get_config_int('price_per_km_car', 300)

    price = base + int(distance_km * per_km)

    # Arrondir aux 50 XOF les plus proches
    price = int(math.ceil(price / 50.0) * 50)

    return price


def calculate_price_bounds(suggested_price: int, vehicle_type: str) -> dict:
    """
    Calcule le plancher et le plafond de prix.
    Le passager et les chauffeurs doivent proposer dans cette fourchette.
    """
    tolerance = get_config_float('price_tolerance_percent', 50.0) / 100.0

    if vehicle_type == 'moto':
        min_price = get_config_int('min_price_moto', 300)
    else:
        min_price = get_config_int('min_price_car', 500)

    floor_price = max(min_price, int(suggested_price * (1 - tolerance)))
    ceil_price = int(suggested_price * (1 + tolerance))

    # Arrondir aux 50 XOF
    floor_price = int(math.ceil(floor_price / 50.0) * 50)
    ceil_price = int(math.floor(ceil_price / 50.0) * 50)

    return {
        'min_price': floor_price,
        'max_price': ceil_price,
        'suggested_price': suggested_price,
    }


def validate_proposed_price(proposed_price: int, suggested_price: int, vehicle_type: str) -> dict:
    """
    Valide le prix proposé par le passager.
    Retourne {'valid': True} ou {'valid': False, 'error': '...'}.
    """
    bounds = calculate_price_bounds(suggested_price, vehicle_type)

    if proposed_price < bounds['min_price']:
        return {
            'valid': False,
            'error': f"Prix trop bas. Minimum : {bounds['min_price']} XOF",
            'min_price': bounds['min_price'],
        }

    if proposed_price > bounds['max_price']:
        return {
            'valid': False,
            'error': f"Prix trop élevé. Maximum : {bounds['max_price']} XOF",
            'max_price': bounds['max_price'],
        }

    return {'valid': True}


def validate_offer_price(offered_price: int, proposed_price: int, suggested_price: int, vehicle_type: str) -> dict:
    """
    Valide le prix proposé par un chauffeur (offre ou contre-offre).
    """
    bounds = calculate_price_bounds(suggested_price, vehicle_type)

    if offered_price < bounds['min_price']:
        return {
            'valid': False,
            'error': f"Prix trop bas. Minimum : {bounds['min_price']} XOF",
        }

    if offered_price > bounds['max_price']:
        return {
            'valid': False,
            'error': f"Prix trop élevé. Maximum : {bounds['max_price']} XOF",
        }

    # Le chauffeur ne peut pas proposer moins de 80% du prix du passager
    min_driver_price = int(proposed_price * 0.80)
    if offered_price < min_driver_price:
        return {
            'valid': False,
            'error': f"Votre offre ne peut pas être inférieure à {min_driver_price} XOF",
        }

    return {'valid': True}


def get_price_estimate(pickup: Point, dropoff: Point, vehicle_type: str) -> dict:
    """
    Retourne l'estimation complète de prix pour une course.
    Appelé par l'endpoint POST /api/rides/estimate.
    """
    distance_m = calculate_distance_geodesic(pickup, dropoff)
    suggested = calculate_suggested_price(distance_m, vehicle_type)
    bounds = calculate_price_bounds(suggested, vehicle_type)

    return {
        'distance_m': distance_m,
        'distance_km': round(distance_m / 1000, 1),
        'suggested_price': suggested,
        'min_price': bounds['min_price'],
        'max_price': bounds['max_price'],
        'vehicle_type': vehicle_type,
        'currency': 'XOF',
    }
