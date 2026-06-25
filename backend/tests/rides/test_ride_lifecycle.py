"""
Tests du RideLifecycleService — transitions de statut, annulations, no-show.
Couvre l'intégralité du cycle de vie d'une course.
"""
import pytest
from django.utils import timezone
from datetime import timedelta

from apps.commissions.models import CommissionCredit
from apps.incidents.models import Incident
from apps.rides.models import Ride, RideOffer, RideRequest
from apps.rides.services.ride_lifecycle_service import (
    RideLifecycleError,
    accept_offer,
    cancel_ride,
    handle_noshow,
    update_ride_status,
)


@pytest.mark.django_db
class TestAcceptOffer:
    """Tests de l'acceptation d'une offre par le passager."""

    def test_acceptation_cree_course(self, ride_request, ride_offer, system_config):
        """Accepter une offre crée une course au statut driver_assigned."""
        ride = accept_offer(ride_request, ride_offer)

        assert ride is not None
        assert ride.status == 'driver_assigned'
        assert ride.agreed_price == ride_offer.offered_price
        assert ride.passenger == ride_request.passenger
        assert ride.driver == ride_offer.driver

    def test_acceptation_met_a_jour_statuts(self, ride_request, ride_offer, system_config):
        """La demande passe en 'accepted', l'offre en 'accepted'."""
        accept_offer(ride_request, ride_offer)

        ride_request.refresh_from_db()
        ride_offer.refresh_from_db()
        assert ride_request.status == 'accepted'
        assert ride_offer.status == 'accepted'

    def test_acceptation_rejette_autres_offres(self, ride_request, ride_offer, driver2, system_config):
        """Les autres offres sont automatiquement rejetées."""
        # Créer une deuxième offre
        offer2 = RideOffer.objects.create(
            ride_request=ride_request,
            driver=driver2,
            offered_price=1200,
            status='pending',
            expires_at=timezone.now() + timedelta(minutes=2),
        )

        accept_offer(ride_request, ride_offer)

        offer2.refresh_from_db()
        assert offer2.status == 'rejected'

    def test_calcule_commission(self, ride_request, ride_offer, system_config):
        """La commission est calculée à 15% du prix convenu."""
        ride = accept_offer(ride_request, ride_offer)
        # 1000 * 15% = 150
        assert ride.commission_amount == 150
        assert ride.commission_rate == 15.0

    def test_erreur_si_demande_deja_acceptee(self, ride_request, ride_offer, system_config):
        """Impossible d'accepter si la demande est déjà acceptée."""
        accept_offer(ride_request, ride_offer)
        ride_request.refresh_from_db()

        # Tenter d'accepter à nouveau
        with pytest.raises(RideLifecycleError):
            accept_offer(ride_request, ride_offer)

    def test_erreur_si_offre_expiree(self, ride_request, ride_offer, system_config):
        """Impossible d'accepter une offre expirée."""
        ride_offer.status = 'expired'
        ride_offer.save()

        with pytest.raises(RideLifecycleError):
            accept_offer(ride_request, ride_offer)


@pytest.mark.django_db
class TestUpdateRideStatus:
    """Tests des transitions de statut d'une course."""

    def test_transition_assigned_vers_en_route(self, ride, system_config):
        """driver_assigned → driver_en_route."""
        updated = update_ride_status(ride, 'driver_en_route')
        assert updated.status == 'driver_en_route'
        assert updated.driver_en_route_at is not None

    def test_transition_en_route_vers_arrived(self, ride, system_config):
        """driver_en_route → driver_arrived."""
        ride.status = 'driver_en_route'
        ride.save()
        updated = update_ride_status(ride, 'driver_arrived')
        assert updated.status == 'driver_arrived'
        assert updated.driver_arrived_at is not None

    def test_transition_arrived_vers_onboard(self, ride, system_config):
        """driver_arrived → passenger_onboard."""
        ride.status = 'driver_arrived'
        ride.save()
        updated = update_ride_status(ride, 'passenger_onboard')
        assert updated.status == 'passenger_onboard'
        assert updated.passenger_onboard_at is not None

    def test_transition_onboard_vers_completed(self, ride, system_config):
        """passenger_onboard → completed."""
        ride.status = 'passenger_onboard'
        ride.save()
        updated = update_ride_status(ride, 'completed')
        assert updated.status == 'completed'
        assert updated.completed_at is not None

    def test_cycle_complet(self, ride, system_config):
        """Teste le cycle complet : assigned → en_route → arrived → onboard → completed."""
        transitions = [
            'driver_en_route',
            'driver_arrived',
            'passenger_onboard',
            'completed',
        ]
        for status in transitions:
            ride = update_ride_status(ride, status)
            assert ride.status == status

    def test_transition_interdite_assigned_vers_completed(self, ride, system_config):
        """driver_assigned → completed est interdit (saut de statut)."""
        with pytest.raises(RideLifecycleError):
            update_ride_status(ride, 'completed')

    def test_transition_interdite_completed_vers_assigned(self, ride, system_config):
        """completed → driver_assigned est interdit (retour en arrière)."""
        ride.status = 'completed'
        ride.save()
        with pytest.raises(RideLifecycleError):
            update_ride_status(ride, 'driver_assigned')

    def test_transition_interdite_cancelled_vers_anything(self, ride, system_config):
        """cancelled → n'importe quoi est interdit (état final)."""
        ride.status = 'cancelled'
        ride.save()
        with pytest.raises(RideLifecycleError):
            update_ride_status(ride, 'driver_en_route')

    def test_transition_interdite_paid_vers_anything(self, ride, system_config):
        """paid → n'importe quoi est interdit (état final)."""
        ride.status = 'paid'
        ride.save()
        with pytest.raises(RideLifecycleError):
            update_ride_status(ride, 'completed')


@pytest.mark.django_db
class TestCancelRide:
    """Tests de l'annulation de course."""

    def test_annulation_par_passager_avec_frais(self, ride, system_config):
        """Annulation par le passager après matching → frais 500 XOF."""
        cancelled = cancel_ride(ride, 'passenger', reason='Changement de plan')

        assert cancelled.status == 'cancelled'
        assert cancelled.cancelled_by == 'passenger'
        assert cancelled.cancellation_fee == 500
        assert cancelled.cancelled_at is not None

    def test_annulation_passager_cree_dette(self, ride, passenger, system_config):
        """L'annulation par le passager crée une dette non-croissante."""
        cancel_ride(ride, 'passenger')

        passenger.refresh_from_db()
        assert passenger.cancellation_debt == 500
        assert passenger.cancellation_debt_created_at is not None

    def test_annulation_par_chauffeur_deduit_credit(self, ride, driver, system_config):
        """Annulation par le chauffeur → frais déduits du crédit."""
        credit_avant = CommissionCredit.objects.get(driver=driver).balance
        cancel_ride(ride, 'driver', reason='Urgence personnelle')

        credit_apres = CommissionCredit.objects.get(driver=driver).balance
        assert credit_apres == credit_avant - 500

    def test_annulation_chauffeur_incremente_compteur(self, ride, driver, system_config):
        """Le compteur d'annulations du chauffeur est incrémenté."""
        assert driver.cancellations_today == 0
        cancel_ride(ride, 'driver')

        driver.refresh_from_db()
        assert driver.cancellations_today == 1

    def test_3_annulations_met_hors_ligne(self, ride, ride_request, ride_offer, driver, passenger, system_config, pickup_point, dropoff_point):
        """3 annulations en 24h → mise hors ligne forcée pendant 1h."""
        driver.cancellations_today = 2  # Déjà 2 annulations
        driver.save()

        cancel_ride(ride, 'driver')

        driver.refresh_from_db()
        assert driver.is_online is False
        assert driver.forced_offline_until is not None
        assert driver.forced_offline_until > timezone.now()

    def test_annulation_impossible_apres_paid(self, ride, system_config):
        """Impossible d'annuler une course déjà payée."""
        ride.status = 'paid'
        ride.save()

        with pytest.raises(RideLifecycleError):
            cancel_ride(ride, 'passenger')

    def test_annulation_pendant_course_ouvre_incident(self, ride, system_config):
        """Annulation pendant passenger_onboard ouvre un incident automatique."""
        ride.status = 'passenger_onboard'
        ride.passenger_onboard_at = timezone.now()
        ride.save()

        cancel_ride(ride, 'passenger', reason='Test incident')

        incidents = Incident.objects.filter(ride=ride)
        assert incidents.count() == 1
        assert incidents.first().priority == 'high'
        assert incidents.first().incident_type == 'dispute'

    def test_annulation_raison_enregistree(self, ride, system_config):
        """La raison d'annulation est bien sauvegardée."""
        cancel_ride(ride, 'passenger', reason='Trop long à attendre')

        ride.refresh_from_db()
        assert ride.cancellation_reason == 'Trop long à attendre'


@pytest.mark.django_db
class TestHandleNoshow:
    """Tests de la gestion des no-shows."""

    def test_noshow_passager(self, ride, passenger, system_config):
        """No-show passager → annulation avec frais pour le passager."""
        ride.status = 'driver_arrived'
        ride.driver_arrived_at = timezone.now()
        ride.save()

        cancelled = handle_noshow(ride, 'passenger')

        assert cancelled.status == 'cancelled'
        assert cancelled.cancelled_by == 'passenger'
        passenger.refresh_from_db()
        assert passenger.cancellation_debt == 500

    def test_noshow_chauffeur(self, ride, driver, passenger, system_config):
        """No-show chauffeur → annulation, frais pour le chauffeur, passager ne paie pas."""
        ride.status = 'driver_en_route'
        ride.save()

        cancelled = handle_noshow(ride, 'driver')

        assert cancelled.status == 'cancelled'
        assert cancelled.cancelled_by == 'driver'
        assert cancelled.cancellation_fee == 0  # Passager ne paie pas

        # Le chauffeur est débité
        credit = CommissionCredit.objects.get(driver=driver)
        assert credit.balance < 5000  # Frais déduits


@pytest.mark.django_db
class TestRideModelTransitions:
    """Tests des transitions autorisées du modèle Ride."""

    def test_transitions_autorisees(self, ride, system_config):
        """Vérifie la matrice de transitions."""
        assert ride.can_transition_to('driver_en_route') is True
        assert ride.can_transition_to('cancelled') is True
        assert ride.can_transition_to('completed') is False  # Saut interdit
        assert ride.can_transition_to('paid') is False  # Saut interdit

    def test_completed_vers_paid(self, completed_ride, system_config):
        """completed → paid est autorisé."""
        assert completed_ride.can_transition_to('paid') is True

    def test_cancelled_etat_final(self, ride, system_config):
        """cancelled est un état final, aucune transition possible."""
        ride.status = 'cancelled'
        ride.save()
        assert ride.can_transition_to('driver_en_route') is False
        assert ride.can_transition_to('paid') is False

    def test_paid_etat_final(self, ride, system_config):
        """paid est un état final."""
        ride.status = 'paid'
        ride.save()
        assert ride.can_transition_to('completed') is False
        assert ride.can_transition_to('cancelled') is False

    def test_generate_share_token(self, ride, system_config):
        """Le token de partage est généré et unique."""
        token = ride.generate_share_token()
        assert token is not None
        assert len(token) > 20
        ride.refresh_from_db()
        assert ride.share_token == token
        assert ride.share_expires_at > timezone.now()
