"""
Service promos et parrainage.
- Validation d'un code promo pour un utilisateur (avec codes personnels)
- Application de la réduction à une course (à l'acceptation d'une offre)
- Crédit des bonus de parrainage à la première course payée du filleul
"""
import logging
import random
import string

from django.db import transaction
from django.utils import timezone

from apps.accounts.models_promo import PromoCode, PromoUsage, Referral

logger = logging.getLogger(__name__)


class PromoError(Exception):
    """Code promo invalide ou inutilisable."""
    pass


def validate_promo_for_user(code: str, user, ride_price: int = 0):
    """
    Valide un code promo pour un utilisateur.
    Retourne (promo, discount). Lève PromoError avec un message utilisateur.
    """
    code = (code or '').strip().upper()
    if not code:
        raise PromoError("Code requis.")

    try:
        promo = PromoCode.objects.get(code=code)
    except PromoCode.DoesNotExist:
        raise PromoError("Code promo invalide.")

    # Codes personnels : réservés à leur propriétaire
    if promo.owner_id and promo.owner_id != user.id:
        raise PromoError("Code promo invalide.")

    if not promo.is_valid:
        raise PromoError("Ce code promo a expiré ou n'est plus disponible.")

    user_uses = PromoUsage.objects.filter(promo_code=promo, user=user).count()
    if user_uses >= promo.max_uses_per_user:
        raise PromoError("Vous avez déjà utilisé ce code promo.")

    if ride_price and ride_price < promo.min_ride_price:
        raise PromoError(
            f"Ce code nécessite une course d'au moins {promo.min_ride_price} F CFA."
        )

    discount = promo.calculate_discount(ride_price) if ride_price else 0
    return promo, discount


def apply_promo_code_to_ride(ride, code: str) -> int:
    """
    Valide et applique un code promo à une course : fixe
    discount_amount/promo_code, enregistre l'utilisation, incrémente le
    compteur. Lève PromoError si le code est inutilisable.
    Retourne la réduction appliquée.
    """
    if ride.discount_amount > 0:
        raise PromoError("Un code promo est déjà appliqué à cette course.")

    promo, discount = validate_promo_for_user(code, ride.passenger, ride.agreed_price)
    if discount <= 0:
        raise PromoError("Ce code ne donne aucune réduction sur cette course.")

    with transaction.atomic():
        promo_locked = PromoCode.objects.select_for_update().get(id=promo.id)
        if not promo_locked.is_valid:
            raise PromoError("Ce code promo a expiré ou n'est plus disponible.")

        ride.promo_code = promo_locked.code
        ride.discount_amount = discount
        ride.save(update_fields=['promo_code', 'discount_amount'])

        PromoUsage.objects.create(
            promo_code=promo_locked,
            user=ride.passenger,
            ride=ride,
            discount_amount=discount,
        )
        promo_locked.current_uses += 1
        promo_locked.save(update_fields=['current_uses', 'updated_at'])

    logger.info(
        f"Promo '{promo.code}' appliquée : course #{str(ride.id)[:8]}, "
        f"-{discount} XOF (passager paie {ride.amount_due} XOF)"
    )
    return discount


def apply_promo_to_ride(ride) -> int:
    """
    Applique le code promo saisi à la création de la demande (appelé à
    l'acceptation d'une offre). Non bloquant : retourne 0 si le code
    n'est plus utilisable.
    """
    code = getattr(ride.ride_request, 'promo_code', '') if ride.ride_request else ''
    if not code:
        return 0
    try:
        return apply_promo_code_to_ride(ride, code)
    except PromoError as e:
        # La promo était valide à la création de la demande mais ne l'est
        # plus (expirée, quota atteint…) : la course se fait sans réduction.
        logger.info(f"Promo '{code}' non appliquée à la course #{str(ride.id)[:8]} : {e}")
        return 0


def credit_referral_bonuses(ride):
    """
    Crédite les bonus de parrainage lorsque le passager ou le chauffeur
    de cette course est un filleul dont c'est la première course payée.
    - Chauffeur : bonus versé en crédit commission
    - Passager : bonus versé en code promo personnel (pas de wallet passager)
    Ne lève jamais d'exception.
    """
    try:
        for user in {ride.passenger, ride.driver.user}:
            referral = Referral.objects.filter(referred=user).first()
            if not referral:
                continue
            if referral.referrer_credited and referral.referred_credited:
                continue

            with transaction.atomic():
                referral = Referral.objects.select_for_update().get(id=referral.id)

                if not referral.referred_credited:
                    _grant_bonus(referral.referred, referral.referred_bonus)
                    referral.referred_credited = True

                if not referral.referrer_credited:
                    _grant_bonus(referral.referrer, referral.referrer_bonus)
                    referral.referrer_credited = True

                referral.save(update_fields=[
                    'referred_credited', 'referrer_credited', 'updated_at'
                ])

            logger.info(
                f"Bonus parrainage crédités : {referral.referrer} ↔ {referral.referred} "
                f"({referral.referrer_bonus}/{referral.referred_bonus} XOF)"
            )
    except Exception as e:
        logger.error(f"Crédit bonus parrainage échoué (non bloquant) : {e}")


def _grant_bonus(user, amount: int):
    """Verse un bonus à un utilisateur selon son rôle."""
    from apps.notifications.services.notification_service import notify_user_async

    driver = getattr(user, 'driver_profile', None)
    if driver is not None:
        # Chauffeur : bonus en crédit commission
        from apps.commissions.services.commission_service import adjust_credit
        adjust_credit(driver, amount, reason="Bonus parrainage")
        notify_user_async(
            user, 'referral_bonus_credit',
            params={'amount': amount},
            notification_type='credit_topup',
        )
    else:
        # Passager : code promo personnel à usage unique
        promo = _create_personal_promo(user, amount)
        notify_user_async(
            user, 'referral_bonus_promo',
            params={'amount': amount, 'code': promo.code},
            notification_type='system',
            data={'promo_code': promo.code},
        )


def _create_personal_promo(user, amount: int) -> PromoCode:
    """Crée un code promo personnel à usage unique (valable 90 jours)."""
    while True:
        code = 'BON' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not PromoCode.objects.filter(code=code).exists():
            break

    return PromoCode.objects.create(
        code=code,
        description="Bonus de parrainage",
        discount_type='fixed',
        discount_value=amount,
        max_uses=1,
        max_uses_per_user=1,
        owner=user,
        valid_until=timezone.now() + timezone.timedelta(days=90),
    )
