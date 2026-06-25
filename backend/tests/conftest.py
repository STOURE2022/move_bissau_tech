"""
Fixtures partagées pour tous les tests MoveBissau.
Fournit des objets préconfigurés : utilisateurs, chauffeurs, demandes, courses.
"""
import pytest
from django.contrib.gis.geos import Point
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import User
from apps.drivers.models import Driver, Vehicle
from apps.rides.models import Ride, RideOffer, RideRequest
from apps.commissions.models import CommissionCredit, CreditTransaction
from apps.payments.models import PaymentProvider
from apps.admin_dashboard.models import SystemConfig, SmsProvider


@pytest.fixture
def system_config(db):
    """Crée la configuration système par défaut pour les tests."""
    configs = [
        ('cancellation_fee', 500, 'cancellation'),
        ('cancellation_debt_expiry_days', 30, 'cancellation'),
        ('driver_max_cancellations_24h', 3, 'cancellation'),
        ('driver_cooldown_minutes', 60, 'cancellation'),
        ('noshow_timeout_s', 300, 'cancellation'),
        ('commission_rate', 15.0, 'commission'),
        ('min_credit_for_rides', 200, 'commission'),
        ('low_balance_threshold', 500, 'commission'),
        ('default_search_radius_m', 3000, 'matching'),
        ('max_search_radius_m', 10000, 'matching'),
        ('radius_increment_m', 2000, 'matching'),
        ('max_drivers_notified', 10, 'matching'),
        ('ride_request_ttl_s', 300, 'matching'),
        ('ride_offer_ttl_s', 120, 'matching'),
        ('price_per_km_moto', 150, 'pricing'),
        ('price_per_km_car', 300, 'pricing'),
        ('base_price_moto', 200, 'pricing'),
        ('base_price_car', 500, 'pricing'),
        ('min_price_moto', 300, 'pricing'),
        ('min_price_car', 500, 'pricing'),
        ('price_tolerance_percent', 50, 'pricing'),
        ('rating_window_hours', 24, 'rating'),
    ]
    for key, value, category in configs:
        SystemConfig.objects.create(key=key, value=value, category=category)


@pytest.fixture
def passenger(db):
    """Crée un passager de test."""
    return User.objects.create_user(
        phone='+245955001001',
        role='passenger',
        first_name='Amadou',
        last_name='Diallo',
        phone_verified=True,
        preferred_lang='fr',
    )


@pytest.fixture
def passenger_with_debt(db):
    """Crée un passager avec une dette d'annulation."""
    return User.objects.create_user(
        phone='+245955001099',
        role='passenger',
        first_name='Ousmane',
        last_name='Ba',
        phone_verified=True,
        cancellation_debt=500,
        cancellation_debt_created_at=timezone.now(),
    )


@pytest.fixture
def driver_user(db):
    """Crée un utilisateur chauffeur."""
    return User.objects.create_user(
        phone='+245955002001',
        role='driver',
        first_name='Mamadu',
        last_name='Sane',
        phone_verified=True,
    )


@pytest.fixture
def driver(db, driver_user):
    """Crée un chauffeur vérifié, en ligne, avec du crédit."""
    d = Driver.objects.create(
        user=driver_user,
        vehicle_type='moto',
        is_verified=True,
        is_online=True,
        verification_status='approved',
        average_rating=4.5,
        total_rides=50,
        acceptance_rate=90.0,
        # Position : centre de Bissau
        current_location=Point(-15.5977, 11.8636, srid=4326),
        location_updated_at=timezone.now(),
    )
    # Créer le crédit commission avec 5000 XOF
    CommissionCredit.objects.create(driver=d, balance=5000)
    # Créer un véhicule
    Vehicle.objects.create(
        driver=d,
        vehicle_type='moto',
        brand='Honda',
        model='CG125',
        color='Rouge',
        plate_number='AB-1234',
    )
    return d


@pytest.fixture
def driver2(db):
    """Crée un second chauffeur pour les tests de matching."""
    user = User.objects.create_user(
        phone='+245955002002',
        role='driver',
        first_name='Braima',
        last_name='Camara',
        phone_verified=True,
    )
    d = Driver.objects.create(
        user=user,
        vehicle_type='moto',
        is_verified=True,
        is_online=True,
        verification_status='approved',
        average_rating=4.0,
        total_rides=30,
        acceptance_rate=85.0,
        # Position : légèrement différente (1 km au nord)
        current_location=Point(-15.5977, 11.8736, srid=4326),
        location_updated_at=timezone.now(),
    )
    CommissionCredit.objects.create(driver=d, balance=3000)
    return d


@pytest.fixture
def driver_no_credit(db):
    """Crée un chauffeur sans crédit suffisant."""
    user = User.objects.create_user(
        phone='+245955002003',
        role='driver',
        first_name='Carlos',
        last_name='Mendes',
        phone_verified=True,
    )
    d = Driver.objects.create(
        user=user,
        vehicle_type='moto',
        is_verified=True,
        is_online=True,
        verification_status='approved',
        current_location=Point(-15.5977, 11.8636, srid=4326),
        location_updated_at=timezone.now(),
    )
    CommissionCredit.objects.create(driver=d, balance=50)  # Sous le seuil
    return d


@pytest.fixture
def driver_offline(db):
    """Crée un chauffeur hors ligne."""
    user = User.objects.create_user(
        phone='+245955002004',
        role='driver',
        first_name='Paulo',
        last_name='Silva',
        phone_verified=True,
    )
    d = Driver.objects.create(
        user=user,
        vehicle_type='moto',
        is_verified=True,
        is_online=False,  # Hors ligne
        verification_status='approved',
        current_location=Point(-15.5977, 11.8636, srid=4326),
        location_updated_at=timezone.now(),
    )
    CommissionCredit.objects.create(driver=d, balance=5000)
    return d


@pytest.fixture
def pickup_point():
    """Point de départ : Praça dos Heróis Nacionais, Bissau."""
    return Point(-15.5977, 11.8636, srid=4326)


@pytest.fixture
def dropoff_point():
    """Point d'arrivée : Aéroport de Bissau (~5 km)."""
    return Point(-15.6531, 11.8886, srid=4326)


@pytest.fixture
def ride_request(db, passenger, pickup_point, dropoff_point, system_config):
    """Crée une demande de course standard."""
    return RideRequest.objects.create(
        passenger=passenger,
        pickup_location=pickup_point,
        pickup_address='Praça dos Heróis',
        dropoff_location=dropoff_point,
        dropoff_address='Aéroport de Bissau',
        estimated_distance_m=5000,
        suggested_price=950,
        proposed_price=1000,
        vehicle_type='moto',
        search_radius_m=3000,
        max_drivers_notified=10,
        status='pending',
        expires_at=timezone.now() + timedelta(minutes=5),
    )


@pytest.fixture
def ride_offer(db, ride_request, driver):
    """Crée une offre de chauffeur sur la demande."""
    return RideOffer.objects.create(
        ride_request=ride_request,
        driver=driver,
        offered_price=1000,
        is_counter_offer=False,
        driver_distance_m=500,
        estimated_arrival_s=120,
        driver_rating=driver.average_rating,
        status='pending',
        expires_at=timezone.now() + timedelta(minutes=2),
    )


@pytest.fixture
def ride(db, ride_request, ride_offer, passenger, driver):
    """Crée une course confirmée au statut driver_assigned."""
    ride_request.status = 'accepted'
    ride_request.save()
    ride_offer.status = 'accepted'
    ride_offer.save()

    return Ride.objects.create(
        ride_request=ride_request,
        ride_offer=ride_offer,
        passenger=passenger,
        driver=driver,
        pickup_location=ride_request.pickup_location,
        pickup_address=ride_request.pickup_address,
        dropoff_location=ride_request.dropoff_location,
        dropoff_address=ride_request.dropoff_address,
        agreed_price=1000,
        commission_rate=15.00,
        vehicle_type='moto',
        status='driver_assigned',
    )


@pytest.fixture
def completed_ride(db, ride):
    """Course au statut completed (prête pour paiement)."""
    ride.status = 'completed'
    ride.completed_at = timezone.now()
    ride.save()
    return ride


@pytest.fixture
def admin_user(db):
    """Crée un administrateur."""
    return User.objects.create_superuser(
        phone='+245955009001',
        first_name='Admin',
        last_name='MoveBissau',
    )
