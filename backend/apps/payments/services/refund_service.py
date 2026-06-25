"""Service de gestion des remboursements."""
import logging

from django.db import transaction
from django.utils import timezone

from apps.payments.models import Payment, Refund

logger = logging.getLogger(__name__)


def create_refund_request(ride, reason, amount=None):
    """Crée une demande de remboursement pour une course."""
    if amount is None:
        amount = ride.agreed_price

    # Déterminer la méthode de remboursement
    payment = Payment.objects.filter(ride=ride, status='completed').first()
    refund_method = 'cash'
    if payment and payment.payment_method in ('orange_money', 'moov_money'):
        refund_method = 'mobile_money'

    refund = Refund.objects.create(
        ride=ride,
        passenger=ride.passenger,
        payment=payment,
        amount=amount,
        reason=reason,
        refund_method=refund_method,
    )

    logger.info(f"Remboursement #{refund.id} créé: {amount} XOF, raison={reason}")
    return refund


@transaction.atomic
def approve_refund(refund_id, admin_user, note=''):
    """Admin approuve un remboursement."""
    refund = Refund.objects.select_for_update().get(id=refund_id)
    if refund.status != 'pending':
        raise ValueError(f"Remboursement déjà traité (statut: {refund.status})")

    refund.status = 'approved'
    refund.processed_by = admin_user
    refund.admin_note = note
    refund.save(update_fields=['status', 'processed_by', 'admin_note', 'updated_at'])

    # Traiter immédiatement
    process_refund(refund)

    return refund


@transaction.atomic
def process_refund(refund):
    """Exécute le remboursement."""
    if refund.refund_method == 'mobile_money' and refund.payment:
        # Appel provider pour rembourser
        try:
            from apps.payments.services.payment_service import get_provider
            provider = get_provider(refund.payment.provider_name)
            if provider and refund.payment.provider_tx_id:
                result = provider.refund(refund.payment.provider_tx_id, refund.amount)
                refund.provider_tx_id = result.get('transaction_id', '')
        except Exception as e:
            logger.error(f"Erreur remboursement mobile money: {e}")
            # On continue quand même — le remboursement sera traité manuellement

    # Recréditer la commission au chauffeur si applicable
    if refund.ride and refund.ride.driver:
        try:
            from apps.commissions.services.commission_service import refund_commission
            refund_commission(refund.ride)
        except Exception as e:
            logger.warning(f"Impossible de recréditer commission: {e}")

    # Marquer le paiement comme remboursé
    if refund.payment:
        refund.payment.status = 'refunded'
        refund.payment.save(update_fields=['status', 'updated_at'])

    refund.status = 'processed'
    refund.processed_at = timezone.now()
    refund.save(update_fields=['status', 'processed_at', 'provider_tx_id', 'updated_at'])

    logger.info(f"Remboursement #{refund.id} traité: {refund.amount} XOF")
    return refund


@transaction.atomic
def reject_refund(refund_id, admin_user, note=''):
    """Admin rejette un remboursement."""
    refund = Refund.objects.select_for_update().get(id=refund_id)
    if refund.status != 'pending':
        raise ValueError(f"Remboursement déjà traité (statut: {refund.status})")

    refund.status = 'rejected'
    refund.processed_by = admin_user
    refund.processed_at = timezone.now()
    refund.admin_note = note
    refund.save(update_fields=['status', 'processed_by', 'processed_at', 'admin_note', 'updated_at'])

    logger.info(f"Remboursement #{refund.id} rejeté par {admin_user}")
    return refund
