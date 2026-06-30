"""Service de reporting financier pour l'admin."""
import csv
import io
from datetime import timedelta

from django.db.models import Sum, Count, Q
from django.utils import timezone

from apps.commissions.models import CreditTransaction, Withdrawal
from apps.payments.models import Payment, Refund
from apps.rides.models import Ride


def get_financial_summary(days=30):
    """Résumé financier global."""
    since = timezone.now() - timedelta(days=days)

    # Courses payées
    paid_rides = Ride.objects.filter(
        status='paid', paid_at__gte=since
    ).aggregate(
        count=Count('id'),
        total_revenue=Sum('agreed_price'),
        total_commission=Sum('commission_amount'),
    )

    # Remboursements
    refunds = Refund.objects.filter(created_at__gte=since).aggregate(
        pending=Count('id', filter=Q(status='pending')),
        processed=Count('id', filter=Q(status='processed')),
        total_refunded=Sum('amount', filter=Q(status='processed')),
    )

    # Top-ups chauffeurs
    topups = CreditTransaction.objects.filter(
        tx_type='topup', created_at__gte=since
    ).aggregate(
        count=Count('id'),
        total=Sum('amount'),
    )

    # Retraits
    withdrawals_data = Withdrawal.objects.filter(created_at__gte=since).aggregate(
        pending=Count('id', filter=Q(status='pending')),
        completed=Count('id', filter=Q(status='completed')),
        total_withdrawn=Sum('amount', filter=Q(status='completed')),
    )

    revenue = paid_rides['total_revenue'] or 0
    commission = paid_rides['total_commission'] or 0
    refunded = refunds['total_refunded'] or 0
    withdrawn = withdrawals_data['total_withdrawn'] or 0

    return {
        'period_days': days,
        'rides': {
            'paid_count': paid_rides['count'] or 0,
            'total_revenue': revenue,
            'total_commission': commission,
            'net_commission': commission - refunded,
        },
        'refunds': {
            'pending': refunds['pending'] or 0,
            'processed': refunds['processed'] or 0,
            'total_refunded': refunded,
        },
        'topups': {
            'count': topups['count'] or 0,
            'total': topups['total'] or 0,
        },
        'withdrawals': {
            'pending': withdrawals_data['pending'] or 0,
            'completed': withdrawals_data['completed'] or 0,
            'total_withdrawn': withdrawn,
        },
    }


def get_revenue_by_day(days=30):
    """Revenus et commissions par jour pour graphique."""
    since = timezone.now() - timedelta(days=days)
    rides = Ride.objects.filter(
        status='paid', paid_at__gte=since
    ).values('paid_at__date').annotate(
        revenue=Sum('agreed_price'),
        commission=Sum('commission_amount'),
        count=Count('id'),
    ).order_by('paid_at__date')

    return [
        {
            'date': str(r['paid_at__date']),
            'revenue': r['revenue'] or 0,
            'commission': r['commission'] or 0,
            'rides': r['count'] or 0,
        }
        for r in rides
    ]


def get_revenue_by_method(days=30):
    """Répartition des revenus par méthode de paiement."""
    since = timezone.now() - timedelta(days=days)
    payments = Payment.objects.filter(
        status='completed', created_at__gte=since
    ).values('payment_method').annotate(
        count=Count('id'),
        total=Sum('amount'),
    )

    return [
        {
            'method': p['payment_method'],
            'count': p['count'] or 0,
            'total': p['total'] or 0,
        }
        for p in payments
    ]


def get_recent_transactions(limit=20):
    """Dernières transactions de tous types."""
    transactions = []

    # Derniers paiements
    for p in Payment.objects.filter(status='completed').order_by('-created_at')[:limit]:
        transactions.append({
            'type': 'payment',
            'amount': p.amount,
            'commission': p.commission_amount,
            'method': p.payment_method,
            'date': p.created_at.isoformat(),
            'label': f"Course payée ({p.get_payment_method_display()})",
        })

    # Derniers remboursements
    for r in Refund.objects.filter(status='processed').order_by('-created_at')[:limit]:
        transactions.append({
            'type': 'refund',
            'amount': -r.amount,
            'method': r.refund_method,
            'date': r.created_at.isoformat(),
            'label': f"Remboursement ({r.get_reason_display()})",
        })

    # Derniers top-ups
    for t in CreditTransaction.objects.filter(tx_type='topup').order_by('-created_at')[:limit]:
        transactions.append({
            'type': 'topup',
            'amount': t.amount,
            'method': t.provider_name or 'mobile_money',
            'date': t.created_at.isoformat(),
            'label': 'Recharge crédit chauffeur',
        })

    # Derniers retraits
    for w in Withdrawal.objects.filter(status='completed').order_by('-created_at')[:limit]:
        transactions.append({
            'type': 'withdrawal',
            'amount': -w.amount,
            'method': w.withdrawal_method,
            'date': w.created_at.isoformat(),
            'label': f"Retrait chauffeur → {w.phone}",
        })

    # Trier par date décroissante
    transactions.sort(key=lambda x: x['date'], reverse=True)
    return transactions[:limit]


def export_financial_csv(start_date, end_date):
    """Exporte les données financières en CSV."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        'Date', 'Type', 'Montant (XOF)', 'Commission (XOF)',
        'Méthode', 'Description',
    ])

    # Paiements
    for p in Payment.objects.filter(
        status='completed',
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    ).order_by('created_at'):
        writer.writerow([
            p.created_at.strftime('%Y-%m-%d %H:%M'),
            'Paiement', p.amount, p.commission_amount,
            p.get_payment_method_display(),
            f"Course #{str(p.ride_id)[:8]}",
        ])

    # Remboursements
    for r in Refund.objects.filter(
        status='processed',
        processed_at__date__gte=start_date,
        processed_at__date__lte=end_date,
    ).order_by('processed_at'):
        writer.writerow([
            r.processed_at.strftime('%Y-%m-%d %H:%M'),
            'Remboursement', -r.amount, 0,
            r.get_refund_method_display(),
            r.get_reason_display(),
        ])

    # Retraits
    for w in Withdrawal.objects.filter(
        status='completed',
        processed_at__date__gte=start_date,
        processed_at__date__lte=end_date,
    ).order_by('processed_at'):
        writer.writerow([
            w.processed_at.strftime('%Y-%m-%d %H:%M'),
            'Retrait', -w.amount, 0,
            w.get_withdrawal_method_display(),
            f"→ {w.phone}",
        ])

    # Ajouter BOM UTF-8 pour que Excel affiche correctement les accents
    return '\ufeff' + output.getvalue()
