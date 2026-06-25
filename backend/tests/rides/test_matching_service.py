"""
Tests du MatchingService — recherche de chauffeurs éligibles et scoring.
"""
import pytest
from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta

from apps.rides.services.matching_service import (
    expand_search_radius,
    find_eligible_drivers,
)
from apps.rides.models import Ride


@pytest.mark.django_db
class TestFindEligibleDrivers:
    """Tests de la recherche de chauffeurs éligibles."""

    def test_trouve_chauffeur_dans_rayon(self, driver, pickup_point, system_config):
        """Un chauffeur en ligne, vérifié, avec crédit, dans le rayon est trouvé."""
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        assert len(results) >= 1
        driver_ids = [r['driver'].id for r in results]
        assert driver.id in driver_ids

    def test_exclut_chauffeur_hors_ligne(self, driver, driver_offline, pickup_point, system_config):
        """Un chauffeur hors ligne n'est pas retourné."""
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        driver_ids = [r['driver'].id for r in results]
        assert driver_offline.id not in driver_ids

    def test_exclut_chauffeur_credit_insuffisant(self, driver, driver_no_credit, pickup_point, system_config):
        """Un chauffeur avec crédit insuffisant n'est pas retourné."""
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        driver_ids = [r['driver'].id for r in results]
        assert driver_no_credit.id not in driver_ids

    def test_exclut_chauffeur_mauvais_type_vehicule(self, driver, pickup_point, system_config):
        """Un chauffeur moto n'est pas retourné pour une demande voiture."""
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='car',  # Le driver fixture est moto
            radius_m=5000,
        )
        driver_ids = [r['driver'].id for r in results]
        assert driver.id not in driver_ids

    def test_exclut_chauffeur_hors_rayon(self, driver, system_config):
        """Un chauffeur hors du rayon n'est pas retourné."""
        # Point très éloigné (Dakar, ~500 km)
        far_point = Point(-17.4467, 14.6928, srid=4326)
        results = find_eligible_drivers(
            pickup_location=far_point,
            vehicle_type='moto',
            radius_m=3000,
        )
        assert len(results) == 0

    def test_exclut_chauffeur_avec_course_active(self, driver, passenger, pickup_point, ride_request, ride_offer, system_config):
        """Un chauffeur avec une course active n'est pas retourné."""
        # Créer une course active pour ce chauffeur
        ride_request.status = 'accepted'
        ride_request.save()
        ride_offer.status = 'accepted'
        ride_offer.save()
        Ride.objects.create(
            ride_request=ride_request,
            ride_offer=ride_offer,
            passenger=passenger,
            driver=driver,
            pickup_location=pickup_point,
            dropoff_location=pickup_point,
            agreed_price=1000,
            vehicle_type='moto',
            status='passenger_onboard',
        )

        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        driver_ids = [r['driver'].id for r in results]
        assert driver.id not in driver_ids

    def test_limite_nombre_chauffeurs(self, driver, driver2, pickup_point, system_config):
        """Le nombre de chauffeurs retournés est limité au maximum configuré."""
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
            max_drivers=1,
        )
        assert len(results) <= 1

    def test_scoring_favorise_proximite(self, driver, driver2, pickup_point, system_config):
        """Le chauffeur le plus proche a un meilleur score."""
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        if len(results) >= 2:
            # Le driver est au même point, driver2 est 1 km plus loin
            assert results[0]['driver'].id == driver.id

    def test_resultats_contiennent_eta(self, driver, pickup_point, system_config):
        """Chaque résultat contient un temps d'arrivée estimé."""
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        for r in results:
            assert 'estimated_arrival_s' in r
            assert r['estimated_arrival_s'] >= 0

    def test_exclut_chauffeur_specifique(self, driver, driver2, pickup_point, system_config):
        """On peut exclure des chauffeurs spécifiques (déjà notifiés)."""
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
            exclude_driver_ids=[driver.id],
        )
        driver_ids = [r['driver'].id for r in results]
        assert driver.id not in driver_ids

    def test_exclut_chauffeur_banni(self, driver, pickup_point, system_config):
        """Un chauffeur banni n'est pas retourné."""
        driver.user.is_banned = True
        driver.user.save()

        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        driver_ids = [r['driver'].id for r in results]
        assert driver.id not in driver_ids

    def test_exclut_chauffeur_en_cooldown(self, driver, pickup_point, system_config):
        """Un chauffeur en mise hors ligne forcée n'est pas retourné."""
        driver.forced_offline_until = timezone.now() + timedelta(hours=1)
        driver.save()

        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        driver_ids = [r['driver'].id for r in results]
        assert driver.id not in driver_ids


@pytest.mark.django_db
class TestExpandSearchRadius:
    """Tests de l'élargissement du rayon de recherche."""

    def test_elargissement_premier_palier(self, system_config):
        """3000 → 5000 (+ 2000)."""
        new = expand_search_radius(3000)
        assert new == 5000

    def test_elargissement_deuxieme_palier(self, system_config):
        """5000 → 7000."""
        new = expand_search_radius(5000)
        assert new == 7000

    def test_max_atteint(self, system_config):
        """Au-delà de 10000, retourne None."""
        new = expand_search_radius(10000)
        assert new is None

    def test_presque_max(self, system_config):
        """9000 → None (9000 + 2000 = 11000 > 10000)."""
        new = expand_search_radius(9000)
        assert new is None
