"""
Service de gestion du crédit commission prépayé.
Mécanique conforme à la contrainte halal : aucun intérêt, aucune dette.
"""
import logging

from django.db import transaction

from apps.commissions.models import CommissionCredit, CreditTransaction
from core.config_service import get_config_float, get_config_int

logger = logging.getLogger(__name__)


class InsufficientCreditError(Exception):
    """Crédit commission insuffisant."""
    pass


def get_or_create_credit(driver) -> CommissionCredit:
    """Récupère ou crée le solde de crédit d'un chauffeur."""
    credit, created = CommissionCredit.objects.get_or_create(
        driver=driver,
        defaults={'balance': 0}
    )
    if created:
        logger.info(f"Crédit commission créé pour le chauffeur {driver.id}")
    return credit


def has_sufficient_credit(driver) -> bool:
    """Vérifie si le chauffeur a assez de crédit pour recevoir des courses."""
    credit = get_or_create_credit(driver)
    min_credit = get_config_int('min_credit_for_rides', 200)
    return credit.balance >= min_credit


def topup_credit(driver, amount: int, provider_name: str = '', provider_tx_id: str = '') -> CreditTransaction:
    """
    Recharge le crédit commission d'un chauffeur.

    Args:
        driver: Instance Driver
        amount: Montant en XOF (doit être positif)
        provider_name: Nom du provider de paiement (orange_money, moov_money)
        provider_tx_id: ID de transaction chez le provider
    """
    if amount <= 0:
        raise ValueError("Le montant de rechargement doit être positif.")

    with transaction.atomic():
        credit = get_or_create_credit(driver)
        # Verrouiller la ligne pour éviter les conditions de course
        credit = CommissionCredit.objects.select_for_update().get(id=credit.id)

        balance_before = credit.balance
        credit.balance += amount
        credit.total_topups += amount
        credit.save(update_fields=['balance', 'total_topups', 'updated_at'])

        tx = CreditTransaction.objects.create(
            driver=driver,
            tx_type='topup',
            amount=amount,
            balance_before=balance_before,
            balance_after=credit.balance,
            provider_name=provider_name,
            provider_tx_id=provider_tx_id,
            description=f"Rechargement {amount} XOF via {provider_name}",
        )

        logger.info(
            f"Crédit rechargé : chauffeur {driver.id}, "
            f"+{amount} XOF, solde {credit.balance} XOF"
        )

    return tx


def calculate_commission(agreed_price: int) -> tuple:
    """
    Calcule la commission pour un prix donné.
    Retourne (commission_rate, commission_amount).
    Fonction centralisée — utiliser partout au lieu de dupliquer la formule.
    """
    commission_rate = get_config_float('commission_rate', 15.0)
    commission_amount = int(agreed_price * commission_rate / 100 + 0.99)
    return commission_rate, commission_amount


def deduct_commission(driver, ride, payment=None) -> CreditTransaction:
    """
    Déduit la commission d'une course du crédit du chauffeur.
    Appelé quand le paiement est confirmé.
    """
    commission_rate, commission_amount = calculate_commission(ride.agreed_price)

    with transaction.atomic():
        credit = CommissionCredit.objects.select_for_update().get(driver=driver)

        # Vérifier que le solde ne devient pas trop négatif
        if credit.balance - commission_amount < -1000:
            logger.warning(
                f"Crédit chauffeur {driver.id} très bas : {credit.balance} - {commission_amount} = {credit.balance - commission_amount}. "
                f"Déduction autorisée mais alerte levée."
            )

        balance_before = credit.balance
        credit.balance -= commission_amount
        credit.total_commissions += commission_amount
        credit.save(update_fields=['balance', 'total_commissions', 'updated_at'])

        tx = CreditTransaction.objects.create(
            driver=driver,
            tx_type='commission',
            amount=-commission_amount,
            balance_before=balance_before,
            balance_after=credit.balance,
            ride=ride,
            payment=payment,
            description=f"Commission {commission_rate}% sur course #{str(ride.id)[:8]} ({ride.agreed_price} XOF)",
        )

        # Mettre à jour le montant de commission sur la course
        ride.commission_amount = commission_amount
        ride.save(update_fields=['commission_amount'])

        logger.info(
            f"Commission déduite : chauffeur {driver.id}, "
            f"-{commission_amount} XOF, solde {credit.balance} XOF"
        )

        # Alerte si crédit bas
        low_threshold = get_config_int('low_balance_threshold', 500)
        if credit.balance < low_threshold:
            _notify_low_credit(driver, credit.balance)

    return tx


def deduct_cancellation_fee(driver, fee_amount: int, ride=None) -> CreditTransaction:
    """
    Déduit les frais d'annulation du crédit du chauffeur.
    """
    with transaction.atomic():
        credit = CommissionCredit.objects.select_for_update().get(driver=driver)

        balance_before = credit.balance
        credit.balance -= fee_amount
        credit.save(update_fields=['balance', 'updated_at'])

        tx = CreditTransaction.objects.create(
            driver=driver,
            tx_type='cancellation_fee',
            amount=-fee_amount,
            balance_before=balance_before,
            balance_after=credit.balance,
            ride=ride,
            description=f"Frais d'annulation {fee_amount} XOF",
        )

        logger.info(
            f"Frais annulation déduits : chauffeur {driver.id}, "
            f"-{fee_amount} XOF, solde {credit.balance} XOF"
        )

    return tx


def adjust_credit(driver, amount: int, reason: str, admin_user=None) -> CreditTransaction:
    """
    Ajustement manuel du crédit par un admin.
    Utilisé pour les remboursements, corrections, etc.
    """
    with transaction.atomic():
        credit = CommissionCredit.objects.select_for_update().get(driver=driver)

        balance_before = credit.balance
        credit.balance += amount
        credit.save(update_fields=['balance', 'updated_at'])

        tx = CreditTransaction.objects.create(
            driver=driver,
            tx_type='adjustment' if amount >= 0 else 'adjustment',
            amount=amount,
            balance_before=balance_before,
            balance_after=credit.balance,
            adjusted_by=admin_user,
            adjustment_reason=reason,
            description=f"Ajustement admin : {'+' if amount >= 0 else ''}{amount} XOF - {reason}",
        )

        logger.info(
            f"Ajustement crédit : chauffeur {driver.id}, "
            f"{'+' if amount >= 0 else ''}{amount} XOF par admin {admin_user}"
        )

    return tx


def _notify_low_credit(driver, balance: int):
    """Notifie le chauffeur que son crédit est bas."""
    try:
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=driver.user,
            title="Crédit commission bas",
            body=f"Votre crédit commission est de {balance} XOF. Rechargez pour continuer à recevoir des courses.",
            notification_type='credit_low',
            data={'balance': balance},
        )
    except Exception as e:
        logger.error(f"Erreur notification crédit bas : {e}")
