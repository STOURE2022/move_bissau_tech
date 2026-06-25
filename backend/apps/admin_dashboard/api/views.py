"""Vues API pour le dashboard admin."""
import logging

from django.db import models as db_models
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model
from django.http import HttpResponse

from apps.admin_dashboard.models import SmsProvider, SystemConfig
from apps.admin_dashboard.services.kpi_service import get_dashboard_kpi
from apps.admin_dashboard.services.financial_service import (
    get_financial_summary, get_revenue_by_day, get_revenue_by_method,
    get_recent_transactions, export_financial_csv,
)
from apps.commissions.models import Withdrawal
from apps.drivers.models import Driver
from apps.incidents.models import Incident
from apps.payments.models import PaymentProvider, Refund
from apps.payments.services.refund_service import approve_refund, reject_refund
from apps.commissions.services.withdrawal_service import (
    approve_withdrawal, reject_withdrawal, complete_withdrawal,
)
from apps.rides.models import Ride
from core.config_service import invalidate_config
from core.permissions import IsAdmin

from .serializers import (
    DriverAdminSerializer,
    DriverSuspendSerializer,
    DriverVerifySerializer,
    IncidentAdminSerializer,
    IncidentUpdateSerializer,
    PassengerAdminSerializer,
    PaymentProviderAdminSerializer,
    PaymentProviderUpdateSerializer,
    RefundAdminSerializer,
    SmsProviderAdminSerializer,
    SmsProviderUpdateSerializer,
    SystemConfigSerializer,
    SystemConfigUpdateSerializer,
    WithdrawalAdminSerializer,
)

logger = logging.getLogger(__name__)


# === Configuration système ===

class PublicCountryConfigView(APIView):
    """GET /api/config/country — Config pays publique (pas besoin d'auth)."""
    permission_classes = [AllowAny]

    def get(self, request):
        from core.config_service import get_config
        return Response({
            'country_code': get_config('country_code', 'gw'),
            'country_name': get_config('country_name', 'Guinée-Bissau'),
            'country_flag': get_config('country_flag', '🇬🇼'),
            'phone_prefix': get_config('phone_prefix', '+245'),
            'default_lat': float(get_config('default_lat', 11.8636)),
            'default_lng': float(get_config('default_lng', -15.5977)),
            'default_zoom': int(get_config('default_zoom', 15)),
            'currency': get_config('currency', 'XOF'),
            'currency_symbol': get_config('currency_symbol', 'F CFA'),
        })


class SystemConfigListView(APIView):
    """GET /api/admin/config — Toutes les configurations."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        configs = SystemConfig.objects.all().order_by('category', 'key')
        return Response(SystemConfigSerializer(configs, many=True).data)


class SystemConfigUpdateView(APIView):
    """PATCH /api/admin/config/<key> — Modifier une configuration."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, key):
        serializer = SystemConfigUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        config, created = SystemConfig.objects.update_or_create(
            key=key,
            defaults={
                'value': serializer.validated_data['value'],
                'updated_by': request.user,
            }
        )
        invalidate_config(key)

        return Response(SystemConfigSerializer(config).data)


# === Chauffeurs ===

class DriverListAdminView(APIView):
    """GET /api/admin/drivers — Liste des chauffeurs."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        drivers = Driver.objects.select_related('user').all()

        # Filtres optionnels
        verification = request.query_params.get('verification_status')
        if verification:
            drivers = drivers.filter(verification_status=verification)

        is_online = request.query_params.get('is_online')
        if is_online is not None:
            drivers = drivers.filter(is_online=is_online == 'true')

        drivers = drivers.order_by('-created_at')
        return Response(DriverAdminSerializer(drivers, many=True).data)


# === Passagers ===

class PassengerListAdminView(APIView):
    """GET /api/admin/passengers — Liste des passagers."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        User = get_user_model()
        passengers = User.objects.filter(role='passenger').order_by('-created_at')

        # Filtres
        search = request.query_params.get('search')
        if search:
            passengers = passengers.filter(
                db_models.Q(phone__icontains=search) |
                db_models.Q(first_name__icontains=search) |
                db_models.Q(last_name__icontains=search)
            )

        is_banned = request.query_params.get('is_banned')
        if is_banned is not None:
            passengers = passengers.filter(is_banned=is_banned == 'true')

        return Response(PassengerAdminSerializer(passengers, many=True).data)


class PassengerBanAdminView(APIView):
    """POST /api/admin/passengers/<id>/ban — Bannir/débannir un passager."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        User = get_user_model()
        try:
            user = User.objects.get(id=user_id, role='passenger')
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action', 'ban')
        if action == 'ban':
            user.is_banned = True
            user.ban_reason = request.data.get('reason', '')
        else:
            user.is_banned = False
            user.ban_reason = ''

        user.save(update_fields=['is_banned', 'ban_reason'])
        return Response(PassengerAdminSerializer(user).data)


class PassengerDebtAdminView(APIView):
    """POST /api/admin/passengers/<id>/clear-debt — Effacer la dette d'annulation."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        User = get_user_model()
        try:
            user = User.objects.get(id=user_id, role='passenger')
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        user.cancellation_debt = 0
        user.cancellation_debt_created_at = None
        user.save(update_fields=['cancellation_debt', 'cancellation_debt_created_at'])
        return Response(PassengerAdminSerializer(user).data)


class DriverVerifyAdminView(APIView):
    """PATCH /api/admin/drivers/<id>/verify — Valider/rejeter un chauffeur."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, driver_id):
        serializer = DriverVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            driver = Driver.objects.get(id=driver_id)
        except Driver.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if data['action'] == 'approve':
            driver.verification_status = 'approved'
            driver.is_verified = True
            driver.rejection_reason = ''
            driver.admin_comment = data.get('comment', '')
        else:
            driver.verification_status = 'rejected'
            driver.is_verified = False
            driver.rejection_reason = data.get('rejection_reason', '')
            driver.admin_comment = data.get('comment', '')

        driver.save()

        # Mettre à jour le statut des documents
        doc_status = 'approved' if data['action'] == 'approve' else 'rejected'
        driver.documents.filter(status='pending').update(
            status=doc_status,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )

        return Response(DriverAdminSerializer(driver).data)


class DriverDocumentVerifyAdminView(APIView):
    """PATCH /api/admin/drivers/<driver_id>/documents/<doc_id> — Valider/rejeter un document."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, driver_id, doc_id):
        from apps.drivers.models import DriverDocument
        try:
            doc = DriverDocument.objects.get(id=doc_id, driver_id=driver_id)
        except DriverDocument.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')  # 'approve' ou 'reject'
        comment = request.data.get('comment', '')

        if action == 'approve':
            doc.status = 'approved'
            doc.rejection_reason = ''
        elif action == 'reject':
            doc.status = 'rejected'
            doc.rejection_reason = comment
        else:
            return Response({'error': 'Action invalide'}, status=status.HTTP_400_BAD_REQUEST)

        doc.reviewed_by = request.user
        doc.reviewed_at = timezone.now()
        doc.save()

        return Response({
            'id': str(doc.id),
            'doc_type': doc.doc_type,
            'status': doc.status,
            'rejection_reason': doc.rejection_reason,
        })


class DriverSuspendAdminView(APIView):
    """POST /api/admin/drivers/<id>/suspend — Suspendre un chauffeur."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, driver_id):
        serializer = DriverSuspendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            driver = Driver.objects.get(id=driver_id)
        except Driver.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        driver.user.is_banned = True
        driver.user.ban_reason = serializer.validated_data['reason']
        driver.user.save(update_fields=['is_banned', 'ban_reason'])

        driver.is_online = False
        driver.save(update_fields=['is_online'])

        return Response({'status': 'suspended'})


# === Courses ===

class RideListAdminView(APIView):
    """GET /api/admin/rides — Liste des courses."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        rides = Ride.objects.select_related(
            'passenger', 'driver', 'driver__user'
        ).all()

        # Filtres
        ride_status = request.query_params.get('status')
        if ride_status:
            rides = rides.filter(status=ride_status)

        rides = rides.order_by('-created_at')[:100]
        from apps.rides.api.serializers import RideSerializer
        return Response(RideSerializer(rides, many=True).data)


class RideLiveAdminView(APIView):
    """GET /api/admin/rides/live — Courses en cours en temps réel."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        active_statuses = [
            'driver_assigned', 'driver_en_route',
            'driver_arrived', 'passenger_onboard'
        ]
        rides = Ride.objects.filter(
            status__in=active_statuses
        ).select_related('passenger', 'driver', 'driver__user')

        from apps.rides.api.serializers import RideSerializer
        return Response(RideSerializer(rides, many=True).data)


# === Incidents ===

class IncidentListAdminView(APIView):
    """GET /api/admin/incidents — Liste des incidents."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        incidents = Incident.objects.select_related('reported_by').all()

        incident_status = request.query_params.get('status')
        if incident_status:
            incidents = incidents.filter(status=incident_status)

        incidents = incidents.order_by('-created_at')[:100]
        return Response(IncidentAdminSerializer(incidents, many=True).data)


class IncidentUpdateAdminView(APIView):
    """PATCH /api/admin/incidents/<id> — Traiter un incident."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, incident_id):
        serializer = IncidentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            incident = Incident.objects.get(id=incident_id)
        except Incident.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        incident.status = data['status']
        if data.get('resolution'):
            incident.resolution = data['resolution']
        if data.get('priority'):
            incident.priority = data['priority']
        if data['status'] in ('resolved', 'closed'):
            incident.resolved_at = timezone.now()
        incident.assigned_to = request.user
        incident.save()

        return Response(IncidentAdminSerializer(incident).data)


# === Remboursements ===

class RefundListAdminView(APIView):
    """GET /api/admin/refunds — Liste des remboursements."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        refunds = Refund.objects.select_related('passenger', 'ride').all()

        refund_status = request.query_params.get('status')
        if refund_status:
            refunds = refunds.filter(status=refund_status)

        reason = request.query_params.get('reason')
        if reason:
            refunds = refunds.filter(reason=reason)

        return Response(RefundAdminSerializer(refunds[:100], many=True).data)


class RefundActionAdminView(APIView):
    """POST /api/admin/refunds/<id>/approve ou /reject."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, refund_id, action):
        note = request.data.get('note', '')
        try:
            if action == 'approve':
                refund = approve_refund(refund_id, request.user, note)
            elif action == 'reject':
                refund = reject_refund(refund_id, request.user, note)
            else:
                return Response({'error': 'Action invalide'}, status=status.HTTP_400_BAD_REQUEST)
            return Response(RefundAdminSerializer(refund).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Refund.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)


# === Retraits chauffeurs ===

class WithdrawalListAdminView(APIView):
    """GET /api/admin/withdrawals — Liste des demandes de retrait."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        withdrawals = Withdrawal.objects.select_related('driver', 'driver__user').all()

        w_status = request.query_params.get('status')
        if w_status:
            withdrawals = withdrawals.filter(status=w_status)

        return Response(WithdrawalAdminSerializer(withdrawals[:100], many=True).data)


class WithdrawalActionAdminView(APIView):
    """POST /api/admin/withdrawals/<id>/approve ou /reject."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, withdrawal_id, action):
        note = request.data.get('note', '')
        try:
            if action == 'approve':
                w = approve_withdrawal(withdrawal_id, request.user)
            elif action == 'reject':
                w = reject_withdrawal(withdrawal_id, request.user, note)
            elif action == 'complete':
                w = Withdrawal.objects.get(id=withdrawal_id)
                w = complete_withdrawal(w)
            else:
                return Response({'error': 'Action invalide'}, status=status.HTTP_400_BAD_REQUEST)
            return Response(WithdrawalAdminSerializer(w).data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Withdrawal.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)


# === Finance ===

class FinanceSummaryView(APIView):
    """GET /api/admin/finance/summary — Résumé financier."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        return Response(get_financial_summary(days))


class FinanceDailyView(APIView):
    """GET /api/admin/finance/daily — Revenus par jour."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        return Response({
            'daily': get_revenue_by_day(days),
            'by_method': get_revenue_by_method(days),
            'transactions': get_recent_transactions(),
        })


class FinanceExportView(APIView):
    """GET /api/admin/finance/export — Export CSV."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        start = request.query_params.get('start', '2020-01-01')
        end = request.query_params.get('end', '2099-12-31')
        csv_content = export_financial_csv(start, end)

        response = HttpResponse(csv_content, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="movebissau_finance_{start}_{end}.csv"'
        return response


# === KPI ===

class KPIDashboardView(APIView):
    """GET /api/admin/kpi/dashboard — KPI globaux."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        kpi = get_dashboard_kpi(days=days)
        return Response(kpi)


# === Payment Providers ===

class PaymentProviderListView(APIView):
    """GET /api/admin/payment-providers — Liste des providers."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        providers = PaymentProvider.objects.all()
        return Response(PaymentProviderAdminSerializer(providers, many=True).data)


class PaymentProviderUpdateView(APIView):
    """PATCH /api/admin/payment-providers/<id> — Configurer un provider."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, provider_id):
        serializer = PaymentProviderUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            provider = PaymentProvider.objects.get(id=provider_id)
        except PaymentProvider.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Mettre à jour les champs simples
        for field in ['is_active', 'api_base_url', 'merchant_id', 'callback_url',
                      'min_amount', 'max_amount', 'config']:
            if field in data:
                setattr(provider, field, data[field])

        # Chiffrer les secrets
        if 'api_key' in data:
            provider.api_key = data['api_key']
        if 'api_secret' in data:
            provider.api_secret = data['api_secret']

        provider.save()
        return Response(PaymentProviderAdminSerializer(provider).data)


# === SMS Providers ===

class SmsProviderListView(APIView):
    """GET /api/admin/sms-providers — Liste des providers SMS."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        providers = SmsProvider.objects.all()
        return Response(SmsProviderAdminSerializer(providers, many=True).data)


class SmsProviderUpdateView(APIView):
    """PATCH /api/admin/sms-providers/<id> — Configurer un provider SMS."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, provider_id):
        serializer = SmsProviderUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            provider = SmsProvider.objects.get(id=provider_id)
        except SmsProvider.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        for field in ['is_active', 'is_primary', 'api_base_url', 'sender_id', 'config']:
            if field in data:
                setattr(provider, field, data[field])

        if 'api_key' in data:
            provider.api_key = data['api_key']
        if 'api_secret' in data:
            provider.api_secret = data['api_secret']

        # Si marqué comme primary, désactiver les autres
        if data.get('is_primary'):
            SmsProvider.objects.exclude(id=provider.id).update(is_primary=False)

        provider.save()
        return Response(SmsProviderAdminSerializer(provider).data)
