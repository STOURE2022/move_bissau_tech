"""
Commande Django pour initialiser la configuration système.
Usage : python manage.py init_config
"""
from django.core.management.base import BaseCommand

from apps.admin_dashboard.models import SmsProvider, SystemConfig
from apps.payments.models import PaymentProvider


class Command(BaseCommand):
    help = "Initialise la configuration système par défaut pour MoveBissau"

    def handle(self, *args, **kwargs):
        configs = [
            # === Pays ===
            ('country_code', 'gw', "Code pays ISO (gw=Guinée-Bissau, fr=France, sn=Sénégal)", 'country'),
            ('country_name', 'Guinée-Bissau', "Nom du pays affiché dans l'app", 'country'),
            ('country_flag', '🇬🇼', "Emoji drapeau du pays", 'country'),
            ('phone_prefix', '+245', "Préfixe téléphonique (+245=GB, +33=FR, +221=SN)", 'country'),
            ('default_lat', 11.8636, "Latitude par défaut de la carte", 'country'),
            ('default_lng', -15.5977, "Longitude par défaut de la carte", 'country'),
            ('default_zoom', 15, "Niveau de zoom par défaut de la carte", 'country'),
            ('currency', 'XOF', "Code devise (XOF, EUR, etc.)", 'country'),
            ('currency_symbol', 'F CFA', "Symbole devise affiché", 'country'),

            # === Numéros SOS ===
            ('sos_police', '117', "Numéro de la police", 'sos'),
            ('sos_pompiers', '118', "Numéro des pompiers", 'sos'),
            ('sos_gendarmerie', '113', "Numéro de la gendarmerie", 'sos'),
            ('sos_samu', '119', "Numéro du SAMU / urgences médicales", 'sos'),

            # === Moyens de paiement visibles ===
            ('payment_cash_visible', True, "Afficher le paiement en espèces", 'payment'),
            ('payment_orange_money_visible', True, "Afficher Orange Money", 'payment'),
            ('payment_moov_money_visible', True, "Afficher Moov Money", 'payment'),
            ('payment_wave_visible', False, "Afficher Wave", 'payment'),

            # === Annulation ===
            ('cancellation_fee', 500, "Frais d'annulation fixe (XOF)", 'cancellation'),
            ('cancellation_debt_expiry_days', 30, "Jours avant expiration dette annulation", 'cancellation'),
            ('driver_max_cancellations_24h', 3, "Annulations max chauffeur avant mise hors ligne", 'cancellation'),
            ('driver_cooldown_minutes', 60, "Durée mise hors ligne forcée (minutes)", 'cancellation'),
            ('noshow_timeout_s', 300, "Timeout no-show passager (secondes)", 'cancellation'),
            ('driver_noshow_timeout_s', 600, "Timeout no-show chauffeur (secondes)", 'cancellation'),

            # === Commission ===
            ('commission_rate', 15.0, "Taux de commission (%)", 'commission'),
            ('min_credit_for_rides', 200, "Crédit minimum pour recevoir des courses (XOF)", 'commission'),
            ('low_balance_threshold', 500, "Seuil alerte crédit bas (XOF)", 'commission'),

            # === Matching ===
            ('default_search_radius_m', 3000, "Rayon de recherche par défaut (mètres)", 'matching'),
            ('max_search_radius_m', 10000, "Rayon de recherche maximum (mètres)", 'matching'),
            ('radius_increment_m', 2000, "Élargissement rayon par palier (mètres)", 'matching'),
            ('max_drivers_notified', 10, "Nombre max de chauffeurs notifiés", 'matching'),
            ('ride_request_ttl_s', 300, "Durée de validité demande (secondes)", 'matching'),
            ('ride_offer_ttl_s', 120, "Durée de validité offre (secondes)", 'matching'),

            # === Prix ===
            ('price_per_km_moto', 150, "Prix par km moto (XOF)", 'pricing'),
            ('price_per_km_car', 300, "Prix par km voiture (XOF)", 'pricing'),
            ('base_price_moto', 200, "Prix de base moto (XOF)", 'pricing'),
            ('base_price_car', 500, "Prix de base voiture (XOF)", 'pricing'),
            ('min_price_moto', 300, "Prix minimum moto (XOF)", 'pricing'),
            ('min_price_car', 500, "Prix minimum voiture (XOF)", 'pricing'),
            ('price_tolerance_percent', 50, "Tolérance prix proposé vs indicatif (%)", 'pricing'),

            # === Notation ===
            ('rating_window_hours', 24, "Fenêtre pour noter après course (heures)", 'rating'),
        ]

        created_count = 0
        for key, value, description, category in configs:
            _, created = SystemConfig.objects.get_or_create(
                key=key,
                defaults={
                    'value': value,
                    'description': description,
                    'category': category,
                }
            )
            if created:
                created_count += 1

        self.stdout.write(f"  {created_count} configuration(s) créée(s)")

        # Providers de paiement (inactifs par défaut — activer quand les clés API sont configurées)
        for name, display in [('orange_money', 'Orange Money'), ('moov_money', 'Moov Money')]:
            _, created = PaymentProvider.objects.get_or_create(
                name=name,
                defaults={
                    'display_name': display,
                    'provider_type': 'mobile_money',
                    'is_active': False,
                }
            )
            if created:
                self.stdout.write(f"  Provider paiement créé : {display}")

        # Provider SMS
        _, created = SmsProvider.objects.get_or_create(
            name='africastalking',
            defaults={
                'display_name': "Africa's Talking",
                'is_active': True,
                'is_primary': True,
            }
        )
        if created:
            self.stdout.write("  Provider SMS créé : Africa's Talking")

        self.stdout.write(self.style.SUCCESS("Configuration initialisée avec succès !"))
