"""
Service de paiement — orchestre les providers et gère le flux.
"""
import logging

from django.db import transaction

from apps.commissions.services.commission_service import deduct_commission
from apps.payments.models import Payment, PaymentProvider
from apps.payments.services.providers.base import AbstractPaymentProvider
from apps.payments.services.providers.moov_money import MoovMoneyProvider
from apps.payments.services.providers.orange_money import OrangeMoneyProvider
from apps.rides.models import Ride

logger = logging.getLogger(__name__)

# Mapping nom de provider → classe d'implémentation
PROVIDER_CLASSES = {
    'orange_money': OrangeMoneyProvider,
    'moov_money': MoovMoneyProvider,
}


class PaymentError(Exception):
    """Erreur de paiement."""
    pass


def get_provider_instance(provider_name: str) -> AbstractPaymentProvider:
    """
    Récupère et instancie le provider de paiement configuré.
    Lit la configuration depuis la base (table payment_providers).
    """
    try:
        provider_config = PaymentProvider.objects.get(
            name=provider_name, is_active=True
        )
    except PaymentProvider.DoesNotExist:
        raise PaymentError(f"Provider '{provider_name}' non trouvé ou inactif.")

    provider_class = PROVIDER_CLASSES.get(provider_name)
    if not provider_class:
        raise PaymentError(f"Implémentation inconnue pour le provider '{provider_name}'")

    config = {
        'api_key': provider_config.api_key,
        'api_secret': provider_config.api_secret,
        'api_base_url': provider_config.api_base_url,
        'merchant_id': provider_config.merchant_id,
        'callback_url': provider_config.callback_url,
        **provider_config.config,
    }

    return provider_class(config)


def get_active_providers() -> list:
    """Retourne la liste des providers de paiement actifs."""
    return list(
        PaymentProvider.objects.filter(is_active=True)
        .values('name', 'display_name', 'provider_type')
    )


def confirm_cash_payment(ride: Ride) -> Payment:
    """
    Confirme un paiement en espèces.
    Le chauffeur confirme avoir reçu l'argent du passager.
    """
    from apps.commissions.services.commission_service import calculate_commission
    commission_rate, commission_amount = calculate_commission(ride.agreed_price)
    # Le passager paie le montant réduit (promo) ; le chauffeur garde ce cash
    # et sera compensé de la réduction sur son crédit (deduct_commission)
    amount_paid = ride.amount_due
    driver_amount = amount_paid

    with transaction.atomic():
        payment = Payment.objects.create(
            ride=ride,
            passenger=ride.passenger,
            driver=ride.driver,
            amount=amount_paid,
            commission_amount=commission_amount,
            driver_amount=driver_amount,
            payment_method='cash',
            status='completed',
            cash_confirmed_by_driver=True,
        )

        # Déduire la commission du crédit prépayé
        deduct_commission(ride.driver, ride, payment)

        # Mettre à jour le statut de la course
        from apps.rides.services.ride_lifecycle_service import update_ride_status
        update_ride_status(ride, 'paid')

        logger.info(
            f"Paiement cash confirmé : course #{str(ride.id)[:8]}, "
            f"{ride.agreed_price} XOF"
        )

    return payment


def initiate_mobile_payment(ride: Ride, payment_method: str, phone: str) -> Payment:
    """
    Initie un paiement mobile money.
    Le résultat final arrive via callback webhook.
    """
    provider = get_provider_instance(payment_method)

    from apps.commissions.services.commission_service import calculate_commission
    commission_rate, commission_amount = calculate_commission(ride.agreed_price)
    # Le passager paie le montant réduit (promo). La commission est déduite
    # du crédit prépayé via deduct_commission() au callback (avec
    # compensation de la réduction pour le chauffeur).
    amount_paid = ride.amount_due
    driver_amount = amount_paid

    with transaction.atomic():
        payment = Payment.objects.create(
            ride=ride,
            passenger=ride.passenger,
            driver=ride.driver,
            amount=amount_paid,
            commission_amount=commission_amount,
            driver_amount=driver_amount,
            payment_method=payment_method,
            status='processing',
            provider_name=payment_method,
        )

        result = provider.initiate_payment(
            amount=amount_paid,
            phone=phone,
            reference=str(payment.id),
            description=f"Course MoveBissau #{str(ride.id)[:8]}",
        )

        if result.success:
            payment.provider_tx_id = result.transaction_id
            payment.provider_response = result.provider_response
            payment.save(update_fields=[
                'provider_tx_id', 'provider_response', 'updated_at'
            ])
            logger.info(f"Paiement mobile initié : {payment.id}")
        else:
            payment.status = 'failed'
            payment.provider_response = result.provider_response
            payment.save(update_fields=['status', 'provider_response', 'updated_at'])
            raise PaymentError(result.error_message or "Échec de l'initiation du paiement")

    return payment


def handle_payment_callback(provider_name: str, payload: dict) -> Payment:
    """
    Traite le callback webhook d'un provider de paiement.
    Appelé quand le provider notifie le résultat du paiement.
    """
    provider = get_provider_instance(provider_name)

    # Identifier le paiement
    reference = payload.get('reference') or payload.get('merchant_reference')
    if not reference:
        raise PaymentError("Référence de paiement manquante dans le callback")

    try:
        payment = Payment.objects.get(id=reference)
    except Payment.DoesNotExist:
        raise PaymentError(f"Paiement non trouvé : {reference}")

    if payment.status == 'completed':
        logger.warning(f"Callback reçu pour un paiement déjà complété : {payment.id}")
        return payment

    # Vérifier le statut auprès du provider
    tx_id = payload.get('transaction_id') or payment.provider_tx_id
    result = provider.check_status(tx_id)

    with transaction.atomic():
        payment.provider_response = result.provider_response
        payment.provider_tx_id = tx_id

        if result.status == 'completed':
            payment.status = 'completed'
            payment.save()

            # Déduire la commission du crédit prépayé
            deduct_commission(payment.driver, payment.ride, payment)

            # Mettre à jour le statut de la course
            from apps.rides.services.ride_lifecycle_service import update_ride_status
            update_ride_status(payment.ride, 'paid')

            logger.info(f"Paiement mobile confirmé via callback : {payment.id}")

        elif result.status == 'failed':
            payment.status = 'failed'
            payment.save()
            logger.warning(f"Paiement mobile échoué via callback : {payment.id}")

        else:
            # Toujours en cours
            payment.save(update_fields=['provider_response', 'provider_tx_id', 'updated_at'])

    return payment
