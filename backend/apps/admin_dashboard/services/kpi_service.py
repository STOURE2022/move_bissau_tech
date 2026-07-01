"""
Service KPI pour le dashboard admin.
Calcul des métriques clés de la plateforme.
"""
import logging
from datetime import timedelta

from django.db.models import Avg, Count, Sum, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.commissions.models import CommissionCredit, CreditTransaction
from apps.drivers.models import Driver
from apps.rides.models import Ride, RideRequest
from apps.accounts.models import User

logger = logging.getLogger(__name__)


def get_dashboard_kpi(days: int = 30) -> dict:
    """
    Calcule les KPI principaux pour le dashboard admin.
    Par défaut, sur les 30 derniers jours.
    """
    now = timezone.now()
    start_date = now - timedelta(days=days)

    # Utilisateurs
    total_passengers = User.objects.filter(role='passenger').count()
    total_drivers = Driver.objects.count()
    verified_drivers = Driver.objects.filter(is_verified=True).count()
    online_drivers = Driver.objects.filter(is_online=True).count()

    # Courses sur la période
    rides_period = Ride.objects.filter(created_at__gte=start_date)
    total_rides = rides_period.count()
    completed_rides = rides_period.filter(status='paid').count()
    cancelled_rides = rides_period.filter(status='cancelled').count()

    # Revenus
    revenue_data = rides_period.filter(status='paid').aggregate(
        total_revenue=Sum('agreed_price'),
        total_commission=Sum('commission_amount'),
        avg_price=Avg('agreed_price'),
    )

    # Courses par jour (moyenne)
    rides_per_day = completed_rides / max(days, 1)

    # Taux de complétion
    completion_rate = (completed_rides / total_rides * 100) if total_rides > 0 else 0

    # Crédit commission total en circulation
    total_credit = CommissionCredit.objects.aggregate(
        total=Sum('balance')
    )['total'] or 0

    # Rechargements sur la période
    topups = CreditTransaction.objects.filter(
        tx_type='topup',
        created_at__gte=start_date,
    ).aggregate(
        total=Sum('amount'),
        count=Count('id'),
    )

    # Série journalière (courses payées + revenus) pour le graphique d'activité
    daily_raw = (
        rides_period.filter(status='paid')
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(
            rides=Count('id'),
            revenue=Sum('agreed_price'),
            commission=Sum('commission_amount'),
        )
        .order_by('day')
    )
    daily_map = {d['day']: d for d in daily_raw}
    daily = []
    for i in range(days):
        day = (now - timedelta(days=days - 1 - i)).date()
        entry = daily_map.get(day)
        daily.append({
            'date': day.isoformat(),
            'rides': entry['rides'] if entry else 0,
            'revenue': (entry['revenue'] or 0) if entry else 0,
            'commission': (entry['commission'] or 0) if entry else 0,
        })

    # Demandes sans offre (taux d'abandon)
    expired_requests = RideRequest.objects.filter(
        status='expired',
        created_at__gte=start_date,
    ).count()
    total_requests = RideRequest.objects.filter(
        created_at__gte=start_date,
    ).count()

    return {
        'period_days': days,
        'users': {
            'total_passengers': total_passengers,
            'total_drivers': total_drivers,
            'verified_drivers': verified_drivers,
            'online_drivers': online_drivers,
            'pending_verification': total_drivers - verified_drivers,
        },
        'rides': {
            'total': total_rides,
            'completed': completed_rides,
            'cancelled': cancelled_rides,
            'rides_per_day': round(rides_per_day, 1),
            'completion_rate': round(completion_rate, 1),
            'total_requests': total_requests,
            'expired_requests': expired_requests,
        },
        'revenue': {
            'total_revenue_xof': revenue_data['total_revenue'] or 0,
            'total_commission_xof': revenue_data['total_commission'] or 0,
            'avg_ride_price_xof': int(revenue_data['avg_price'] or 0),
        },
        'commission_credit': {
            'total_balance_xof': total_credit,
            'topups_count': topups['count'] or 0,
            'topups_total_xof': topups['total'] or 0,
        },
        'daily': daily,
    }
