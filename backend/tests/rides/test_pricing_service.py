"""
Tests du PricingService — calcul de prix, plancher, plafond, validation.
"""
import pytest
from django.contrib.gis.geos import Point

from apps.rides.services.pricing_service import (
    calculate_distance_geodesic,
    calculate_price_bounds,
    calculate_suggested_price,
    get_price_estimate,
    validate_offer_price,
    validate_proposed_price,
)


class TestCalculateDistance:
    """Tests du calcul de distance géodésique."""

    def test_distance_meme_point(self):
        """La distance d'un point à lui-même est 0."""
        p = Point(-15.5977, 11.8636, srid=4326)
        dist = calculate_distance_geodesic(p, p)
        assert dist == 0

    def test_distance_bissau_aeroport(self):
        """Distance Praça → Aéroport ≈ 5-8 km (avec facteur route)."""
        pickup = Point(-15.5977, 11.8636, srid=4326)
        dropoff = Point(-15.6531, 11.8886, srid=4326)
        dist = calculate_distance_geodesic(pickup, dropoff)
        # La distance réelle est ~6 km, avec facteur 1.3 → ~7-8 km
        assert 5000 < dist < 12000

    def test_distance_courte(self):
        """Distance très courte (même quartier) < 2 km."""
        pickup = Point(-15.5977, 11.8636, srid=4326)
        dropoff = Point(-15.5950, 11.8650, srid=4326)
        dist = calculate_distance_geodesic(pickup, dropoff)
        assert dist < 2000


class TestCalculateSuggestedPrice:
    """Tests du calcul du prix indicatif."""

    @pytest.mark.usefixtures('system_config')
    def test_prix_moto_courte_distance(self):
        """Moto, 2 km → base(200) + 2×150 = 500 XOF (arrondi aux 50)."""
        price = calculate_suggested_price(2000, 'moto')
        assert price == 500

    @pytest.mark.usefixtures('system_config')
    def test_prix_moto_moyenne_distance(self):
        """Moto, 5 km → base(200) + 5×150 = 950 XOF."""
        price = calculate_suggested_price(5000, 'moto')
        assert price == 950

    @pytest.mark.usefixtures('system_config')
    def test_prix_voiture_5km(self):
        """Voiture, 5 km → base(500) + 5×300 = 2000 XOF."""
        price = calculate_suggested_price(5000, 'car')
        assert price == 2000

    @pytest.mark.usefixtures('system_config')
    def test_prix_arrondi_aux_50(self):
        """Le prix est arrondi au multiple de 50 supérieur."""
        # 3.3 km moto → 200 + 3.3×150 = 695 → arrondi 700
        price = calculate_suggested_price(3300, 'moto')
        assert price % 50 == 0

    @pytest.mark.usefixtures('system_config')
    def test_prix_distance_nulle(self):
        """Distance 0 → prix de base seulement."""
        price = calculate_suggested_price(0, 'moto')
        assert price == 200

    @pytest.mark.usefixtures('system_config')
    def test_prix_longue_distance(self):
        """Moto, 10 km → base(200) + 10×150 = 1700 XOF."""
        price = calculate_suggested_price(10000, 'moto')
        assert price == 1700


class TestCalculatePriceBounds:
    """Tests du calcul plancher/plafond."""

    @pytest.mark.usefixtures('system_config')
    def test_bounds_moto_standard(self):
        """Moto, prix suggéré 950 → plancher 475, plafond 1425."""
        bounds = calculate_price_bounds(950, 'moto')
        assert bounds['min_price'] >= 300  # Min absolu moto
        assert bounds['max_price'] > bounds['min_price']
        assert bounds['min_price'] == 500  # MAX(300, 950*0.5=475) arrondi 500
        assert bounds['max_price'] == 1400  # 950*1.5=1425 arrondi 1400

    @pytest.mark.usefixtures('system_config')
    def test_bounds_voiture_standard(self):
        """Voiture, prix suggéré 2000 → bornes cohérentes."""
        bounds = calculate_price_bounds(2000, 'car')
        assert bounds['min_price'] >= 500  # Min absolu voiture
        assert bounds['max_price'] == 3000  # 2000*1.5=3000

    @pytest.mark.usefixtures('system_config')
    def test_plancher_ne_descend_pas_sous_min(self):
        """Le plancher ne descend jamais sous le prix minimum absolu."""
        bounds = calculate_price_bounds(400, 'moto')
        assert bounds['min_price'] >= 300

    @pytest.mark.usefixtures('system_config')
    def test_plancher_voiture_min_500(self):
        """Le plancher voiture est au minimum 500 XOF."""
        bounds = calculate_price_bounds(600, 'car')
        assert bounds['min_price'] >= 500


class TestValidateProposedPrice:
    """Tests de la validation du prix proposé par le passager."""

    @pytest.mark.usefixtures('system_config')
    def test_prix_dans_la_fourchette(self):
        """Un prix dans la fourchette est accepté."""
        result = validate_proposed_price(1000, 950, 'moto')
        assert result['valid'] is True

    @pytest.mark.usefixtures('system_config')
    def test_prix_trop_bas(self):
        """Un prix sous le plancher est rejeté."""
        result = validate_proposed_price(100, 950, 'moto')
        assert result['valid'] is False
        assert 'trop bas' in result['error'].lower()

    @pytest.mark.usefixtures('system_config')
    def test_prix_trop_haut(self):
        """Un prix au-dessus du plafond est rejeté."""
        result = validate_proposed_price(5000, 950, 'moto')
        assert result['valid'] is False
        assert 'trop élevé' in result['error'].lower()

    @pytest.mark.usefixtures('system_config')
    def test_prix_egal_suggere(self):
        """Le prix suggéré est toujours accepté."""
        result = validate_proposed_price(950, 950, 'moto')
        assert result['valid'] is True


class TestValidateOfferPrice:
    """Tests de la validation du prix proposé par le chauffeur."""

    @pytest.mark.usefixtures('system_config')
    def test_offre_acceptation_directe(self):
        """Le chauffeur accepte le prix du passager."""
        result = validate_offer_price(1000, 1000, 950, 'moto')
        assert result['valid'] is True

    @pytest.mark.usefixtures('system_config')
    def test_contre_offre_valide(self):
        """Contre-offre dans la fourchette."""
        result = validate_offer_price(1200, 1000, 950, 'moto')
        assert result['valid'] is True

    @pytest.mark.usefixtures('system_config')
    def test_contre_offre_trop_basse(self):
        """Le chauffeur ne peut pas proposer moins de 80% du prix passager."""
        # 80% de 1000 = 800
        result = validate_offer_price(700, 1000, 950, 'moto')
        assert result['valid'] is False

    @pytest.mark.usefixtures('system_config')
    def test_contre_offre_au_dessus_plafond(self):
        """Le chauffeur ne peut pas dépasser le plafond."""
        result = validate_offer_price(5000, 1000, 950, 'moto')
        assert result['valid'] is False


class TestGetPriceEstimate:
    """Tests de l'estimation complète."""

    @pytest.mark.usefixtures('system_config')
    def test_estimation_complete(self):
        """L'estimation retourne tous les champs nécessaires."""
        pickup = Point(-15.5977, 11.8636, srid=4326)
        dropoff = Point(-15.6531, 11.8886, srid=4326)

        estimate = get_price_estimate(pickup, dropoff, 'moto')

        assert 'distance_m' in estimate
        assert 'distance_km' in estimate
        assert 'suggested_price' in estimate
        assert 'min_price' in estimate
        assert 'max_price' in estimate
        assert estimate['currency'] == 'XOF'
        assert estimate['min_price'] < estimate['suggested_price'] < estimate['max_price']
        assert estimate['distance_m'] > 0
