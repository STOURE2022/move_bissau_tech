"""Service de gestion des retraits de crédit chauffeur."""
import logging

from django.db import transaction
from django.utils import timezone

from apps.commissions.models import CommissionCredit, CreditTransaction, Withdrawal
from core.config_service import get_config_int

logger = logging.getLogger(__name__)


@transaction.atomic
def request_withdrawal(driver, amount, method, phone):
    """Chauffeur demande un retrait de crédit."""
    credit = CommissionCredit.objects.select_for_update().get(driver=driver)
    min_credit = get_config_int('min_credit_for_rides', 200)
    available = credit.balance - min_credit

    if amount <= 0:
        raise ValueError("Le montant doit être positif.")
    if amount > available:
        raise ValueError(f"Solde disponible insuffisant. Maximum : {available} XOF")

    # Vérifier qu'il n'y a pas déjà un retrait en attente
    pending = Withdrawal.objects.filter(driver=driver, status__in=['pending', 'approved', 'processing']).exists()
    if pending:
        raise ValueError("Vous avez déjà un retrait en cours.")

    # Bloquer le montant immédiatement
    balance_before = credit.balance
    credit.balance -= amount
    credit.save(update_fields=['balance', 'updated_at'])

    CreditTransaction.objects.create(
        driver=driver,
        tx_type='withdrawal_hold',
        amount=-amount,
        balance_before=balance_before,
        balance_after=credit.balance,
        description=f"Retrait en attente: {amount} XOF → {phone}",
    )

    withdrawal = Withdrawal.objects.create(
        driver=driver,
        amount=amount,
        withdrawal_method=method,
        phone=phone,
    )

    logger.info(f"Retrait #{withdrawal.id} demandé: {amount} XOF → {phone}")
    return withdrawal


@transaction.atomic
def approve_withdrawal(withdrawal_id, admin_user):
    """Admin approuve un retrait — déclenche le paiement."""
    withdrawal = Withdrawal.objects.select_for_update().get(id=withdrawal_id)
    if withdrawal.status != 'pending':
        raise ValueError(f"Retrait déjà traité (statut: {withdrawal.status})")

    withdrawal.status = 'approved'
    withdrawal.processed_by = admin_user
    withdrawal.save(update_fields=['status', 'processed_by', 'updated_at'])

    # Initier le paiement vers le chauffeur
    try:
        process_withdrawal_payment(withdrawal)
    except Exception as e:
        logger.error(f"Erreur paiement retrait #{withdrawal.id}: {e}")
        # On laisse en 'approved' pour retry

    return withdrawal


def process_withdrawal_payment(withdrawal):
    """Envoie l'argent au chauffeur via mobile money."""
    try:
        from apps.payments.services.payment_service import get_provider
        provider = get_provider(withdrawal.withdrawal_method)
        if provider:
            withdrawal.status = 'processing'
            withdrawal.save(update_fields=['status', 'updated_at'])

            result = provider.initiate_payment(
                amount=withdrawal.amount,
                phone=withdrawal.phone,
                reference=str(withdrawal.id),
                description=f"Retrait MoveBissau #{str(withdrawal.id)[:8]}",
            )
            withdrawal.provider_tx_id = result.get('transaction_id', '')
            withdrawal.save(update_fields=['provider_tx_id', 'updated_at'])
    except Exception as e:
        logger.error(f"Erreur provider pour retrait #{withdrawal.id}: {e}")
        raise


@transaction.atomic
def complete_withdrawal(withdrawal):
    """Marque un retrait comme effectué (callback ou confirmation manuelle)."""
    if withdrawal.status not in ('approved', 'processing'):
        raise ValueError(f"Retrait non traitable (statut: {withdrawal.status})")

    withdrawal.status = 'completed'
    withdrawal.processed_at = timezone.now()
    withdrawal.save(update_fields=['status', 'processed_at', 'updated_at'])

    # Transaction de confirmation
    credit = withdrawal.driver.commission_credit
    CreditTransaction.objects.create(
        driver=withdrawal.driver,
        tx_type='withdrawal_completed',
        amount=0,
        balance_before=credit.balance,
        balance_after=credit.balance,
        description=f"Retrait confirmé: {withdrawal.amount} XOF → {withdrawal.phone}",
    )

    logger.info(f"Retrait #{withdrawal.id} effectué: {withdrawal.amount} XOF")
    return withdrawal


@transaction.atomic
def reject_withdrawal(withdrawal_id, admin_user, note=''):
    """Admin rejette un retrait — recrédite le montant."""
    withdrawal = Withdrawal.objects.select_for_update().get(id=withdrawal_id)
    if withdrawal.status not in ('pending', 'approved'):
        raise ValueError(f"Retrait non annulable (statut: {withdrawal.status})")

    # Recréditer le montant
    credit = CommissionCredit.objects.select_for_update().get(driver=withdrawal.driver)
    balance_before = credit.balance
    credit.balance += withdrawal.amount
    credit.save(update_fields=['balance', 'updated_at'])

    CreditTransaction.objects.create(
        driver=withdrawal.driver,
        tx_type='withdrawal_release',
        amount=withdrawal.amount,
        balance_before=balance_before,
        balance_after=credit.balance,
        description=f"Retrait rejeté et recrédité: {withdrawal.amount} XOF",
    )

    withdrawal.status = 'rejected'
    withdrawal.processed_by = admin_user
    withdrawal.processed_at = timezone.now()
    withdrawal.admin_note = note
    withdrawal.save(update_fields=['status', 'processed_by', 'processed_at', 'admin_note', 'updated_at'])

    logger.info(f"Retrait #{withdrawal.id} rejeté, {withdrawal.amount} XOF recrédité")
    return withdrawal
