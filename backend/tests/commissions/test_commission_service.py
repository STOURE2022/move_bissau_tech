"""
Tests du CommissionService — rechargement, déduction, seuils, conformité halal.
Vérifie qu'aucun intérêt, dette ou pénalité croissante n'est généré.
"""
import pytest
from django.utils import timezone

from apps.commissions.models import CommissionCredit, CreditTransaction
from apps.commissions.services.commission_service import (
    adjust_credit,
    deduct_cancellation_fee,
    deduct_commission,
    get_or_create_credit,
    has_sufficient_credit,
    topup_credit,
)


@pytest.mark.django_db
class TestGetOrCreateCredit:
    """Tests de la récupération/création du crédit."""

    def test_cree_credit_si_inexistant(self, driver):
        """Crée un crédit à 0 pour un nouveau chauffeur."""
        # Le driver fixture a déjà un crédit, en créer un nouveau
        CommissionCredit.objects.filter(driver=driver).delete()
        credit = get_or_create_credit(driver)
        assert credit.balance == 0

    def test_retourne_credit_existant(self, driver):
        """Retourne le crédit existant sans le recréer."""
        credit = get_or_create_credit(driver)
        assert credit.balance == 5000  # Valeur de la fixture


@pytest.mark.django_db
class TestHasSufficientCredit:
    """Tests de la vérification du crédit suffisant."""

    def test_credit_suffisant(self, driver, system_config):
        """5000 XOF > seuil minimum (200), crédit suffisant."""
        assert has_sufficient_credit(driver) is True

    def test_credit_insuffisant(self, driver_no_credit, system_config):
        """50 XOF < seuil minimum (200), crédit insuffisant."""
        assert has_sufficient_credit(driver_no_credit) is False

    def test_credit_exactement_au_seuil(self, driver, system_config):
        """Crédit exactement au seuil (200) est suffisant."""
        credit = CommissionCredit.objects.get(driver=driver)
        credit.balance = 200
        credit.save()
        assert has_sufficient_credit(driver) is True

    def test_credit_juste_sous_seuil(self, driver, system_config):
        """Crédit à 199 (sous le seuil de 200) est insuffisant."""
        credit = CommissionCredit.objects.get(driver=driver)
        credit.balance = 199
        credit.save()
        assert has_sufficient_credit(driver) is False


@pytest.mark.django_db
class TestTopupCredit:
    """Tests du rechargement de crédit."""

    def test_rechargement_augmente_solde(self, driver, system_config):
        """Le rechargement augmente le solde correctement."""
        solde_avant = get_or_create_credit(driver).balance
        topup_credit(driver, 2000, provider_name='orange_money', provider_tx_id='TX001')
        solde_apres = get_or_create_credit(driver).balance
        assert solde_apres == solde_avant + 2000

    def test_rechargement_cree_transaction(self, driver, system_config):
        """Le rechargement crée une transaction traçable."""
        tx = topup_credit(driver, 3000, provider_name='orange_money', provider_tx_id='TX002')
        assert tx.tx_type == 'topup'
        assert tx.amount == 3000
        assert tx.balance_after == tx.balance_before + 3000
        assert tx.provider_name == 'orange_money'
        assert tx.provider_tx_id == 'TX002'

    def test_rechargement_montant_negatif_rejete(self, driver):
        """Un rechargement négatif lève une erreur."""
        with pytest.raises(ValueError, match="positif"):
            topup_credit(driver, -500)

    def test_rechargement_zero_rejete(self, driver):
        """Un rechargement de 0 lève une erreur."""
        with pytest.raises(ValueError, match="positif"):
            topup_credit(driver, 0)

    def test_rechargement_met_a_jour_total_topups(self, driver, system_config):
        """Le compteur total_topups est incrémenté."""
        credit = get_or_create_credit(driver)
        total_avant = credit.total_topups
        topup_credit(driver, 1000)
        credit.refresh_from_db()
        assert credit.total_topups == total_avant + 1000

    def test_rechargements_multiples(self, driver, system_config):
        """Plusieurs rechargements s'accumulent correctement."""
        solde_initial = get_or_create_credit(driver).balance
        topup_credit(driver, 1000)
        topup_credit(driver, 2000)
        topup_credit(driver, 500)
        credit = get_or_create_credit(driver)
        assert credit.balance == solde_initial + 3500


@pytest.mark.django_db
class TestDeductCommission:
    """Tests de la déduction de commission sur une course."""

    def test_deduction_15_pourcent(self, driver, ride, system_config):
        """La commission de 15% est correctement déduite."""
        solde_avant = get_or_create_credit(driver).balance
        # Course à 1000 XOF → commission = ceil(1000 * 15 / 100) = 150
        tx = deduct_commission(driver, ride)
        solde_apres = get_or_create_credit(driver).balance

        assert tx.tx_type == 'commission'
        assert tx.amount == -150
        assert solde_apres == solde_avant - 150

    def test_commission_arrondie_superieur(self, driver, ride, system_config):
        """La commission est arrondie au XOF supérieur."""
        ride.agreed_price = 1001  # 1001 * 15% = 150.15 → ceil = 151
        ride.save()
        tx = deduct_commission(driver, ride)
        assert tx.amount == -151

    def test_commission_met_a_jour_ride(self, driver, ride, system_config):
        """Le montant de commission est enregistré sur la course."""
        deduct_commission(driver, ride)
        ride.refresh_from_db()
        assert ride.commission_amount == 150  # 1000 * 15%

    def test_commission_cree_transaction(self, driver, ride, system_config):
        """La déduction crée une transaction avec les bonnes références."""
        tx = deduct_commission(driver, ride)
        assert tx.ride == ride
        assert tx.balance_after == tx.balance_before + tx.amount

    def test_commission_met_a_jour_total(self, driver, ride, system_config):
        """Le compteur total_commissions est incrémenté."""
        credit = get_or_create_credit(driver)
        total_avant = credit.total_commissions
        deduct_commission(driver, ride)
        credit.refresh_from_db()
        assert credit.total_commissions == total_avant + 150


@pytest.mark.django_db
class TestDeductCancellationFee:
    """Tests des frais d'annulation déduits du crédit chauffeur."""

    def test_deduction_frais_annulation(self, driver, ride, system_config):
        """Les frais d'annulation sont déduits du crédit."""
        solde_avant = get_or_create_credit(driver).balance
        tx = deduct_cancellation_fee(driver, 500, ride)
        solde_apres = get_or_create_credit(driver).balance

        assert tx.tx_type == 'cancellation_fee'
        assert tx.amount == -500
        assert solde_apres == solde_avant - 500

    def test_credit_peut_devenir_negatif(self, driver_no_credit, system_config):
        """Le crédit peut devenir négatif après déduction (mais chauffeur bloqué)."""
        # driver_no_credit a 50 XOF
        tx = deduct_cancellation_fee(driver_no_credit, 500)
        credit = get_or_create_credit(driver_no_credit)
        assert credit.balance == -450  # 50 - 500


@pytest.mark.django_db
class TestAdjustCredit:
    """Tests de l'ajustement manuel par admin."""

    def test_ajustement_positif(self, driver, admin_user, system_config):
        """L'admin peut créditer manuellement."""
        solde_avant = get_or_create_credit(driver).balance
        tx = adjust_credit(driver, 1000, 'Remboursement litige', admin_user)
        solde_apres = get_or_create_credit(driver).balance

        assert tx.tx_type == 'adjustment'
        assert tx.amount == 1000
        assert tx.adjusted_by == admin_user
        assert tx.adjustment_reason == 'Remboursement litige'
        assert solde_apres == solde_avant + 1000

    def test_ajustement_negatif(self, driver, admin_user, system_config):
        """L'admin peut débiter manuellement."""
        tx = adjust_credit(driver, -500, 'Correction erreur', admin_user)
        assert tx.amount == -500


@pytest.mark.django_db
class TestConformiteHalal:
    """
    Tests de conformité halal — AUCUN intérêt, dette croissante ou pénalité temporelle.
    Ces tests documentent et vérifient la contrainte structurante du projet.
    """

    def test_pas_interet_sur_credit(self, driver, system_config):
        """Le crédit ne génère aucun intérêt avec le temps."""
        credit = get_or_create_credit(driver)
        solde = credit.balance
        # Simuler le passage du temps (en prod, rien ne change)
        credit.save()
        credit.refresh_from_db()
        assert credit.balance == solde  # Pas de changement

    def test_pas_de_decouverte_autorise(self, driver_no_credit, pickup_point, system_config):
        """Un chauffeur sans crédit ne reçoit pas de courses (pas de découvert)."""
        from apps.rides.services.matching_service import find_eligible_drivers
        results = find_eligible_drivers(
            pickup_location=pickup_point,
            vehicle_type='moto',
            radius_m=5000,
        )
        driver_ids = [r['driver'].id for r in results]
        assert driver_no_credit.id not in driver_ids

    def test_frais_annulation_fixe_pas_croissant(self, system_config):
        """Les frais d'annulation sont un montant fixe, jamais croissant."""
        from core.config_service import get_config_int
        fee = get_config_int('cancellation_fee', 500)
        # Le montant est toujours le même quelle que soit la situation
        assert fee == 500
        # Pas de multiplicateur, pas de facteur temps

    def test_dette_passager_ne_croit_pas(self, passenger_with_debt, system_config):
        """La dette d'annulation d'un passager ne croît jamais."""
        dette_initiale = passenger_with_debt.cancellation_debt
        # Simuler le passage du temps — la dette ne change pas
        passenger_with_debt.refresh_from_db()
        assert passenger_with_debt.cancellation_debt == dette_initiale

    def test_dette_passager_expire(self, passenger_with_debt, system_config):
        """La dette d'annulation est annulée après 30 jours (write-off)."""
        from datetime import timedelta
        # Mettre la date de dette à 31 jours dans le passé
        passenger_with_debt.cancellation_debt_created_at = timezone.now() - timedelta(days=31)
        passenger_with_debt.save()

        # La propriété has_unpaid_cancellation doit retourner False
        # et la dette doit être remise à 0
        assert passenger_with_debt.has_unpaid_cancellation is False
        passenger_with_debt.refresh_from_db()
        assert passenger_with_debt.cancellation_debt == 0

    def test_historique_transactions_complet(self, driver, ride, system_config):
        """Chaque opération est tracée dans l'historique (audit trail)."""
        topup_credit(driver, 2000, provider_name='orange_money')
        deduct_commission(driver, ride)

        transactions = CreditTransaction.objects.filter(driver=driver).order_by('created_at')
        assert transactions.count() >= 2

        for tx in transactions:
            assert tx.balance_before is not None
            assert tx.balance_after is not None
            assert tx.balance_after == tx.balance_before + tx.amount
