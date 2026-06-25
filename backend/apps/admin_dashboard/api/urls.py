"""URLs pour le dashboard admin."""
from django.urls import path

from apps.accounts.api.views import AdminResetPasswordView as admin_reset_password_view_cls
from . import views

admin_reset_password_view = admin_reset_password_view_cls.as_view()

urlpatterns = [
    # Configuration système
    path('config', views.SystemConfigListView.as_view(), name='admin-config-list'),
    path('config/<str:key>', views.SystemConfigUpdateView.as_view(), name='admin-config-update'),

    # Passagers
    path('passengers', views.PassengerListAdminView.as_view(), name='admin-passengers'),
    path('passengers/<uuid:user_id>/ban', views.PassengerBanAdminView.as_view(), name='admin-passenger-ban'),
    path('passengers/<uuid:user_id>/clear-debt', views.PassengerDebtAdminView.as_view(), name='admin-passenger-clear-debt'),

    # Reset mot de passe par l'admin
    path('users/<uuid:user_id>/reset-password', admin_reset_password_view, name='admin-reset-password'),

    # Chauffeurs
    path('drivers', views.DriverListAdminView.as_view(), name='admin-drivers'),
    path('drivers/<uuid:driver_id>/verify', views.DriverVerifyAdminView.as_view(), name='admin-driver-verify'),
    path('drivers/<uuid:driver_id>/suspend', views.DriverSuspendAdminView.as_view(), name='admin-driver-suspend'),
    path('drivers/<uuid:driver_id>/documents/<uuid:doc_id>', views.DriverDocumentVerifyAdminView.as_view(), name='admin-driver-doc-verify'),

    # Courses
    path('rides', views.RideListAdminView.as_view(), name='admin-rides'),
    path('rides/live', views.RideLiveAdminView.as_view(), name='admin-rides-live'),

    # Incidents
    path('incidents', views.IncidentListAdminView.as_view(), name='admin-incidents'),
    path('incidents/<uuid:incident_id>', views.IncidentUpdateAdminView.as_view(), name='admin-incident-update'),

    # KPI
    path('kpi/dashboard', views.KPIDashboardView.as_view(), name='admin-kpi'),

    # Payment providers
    path('payment-providers', views.PaymentProviderListView.as_view(), name='admin-payment-providers'),
    path('payment-providers/<uuid:provider_id>', views.PaymentProviderUpdateView.as_view(), name='admin-payment-provider-update'),

    # SMS providers
    path('sms-providers', views.SmsProviderListView.as_view(), name='admin-sms-providers'),
    path('sms-providers/<uuid:provider_id>', views.SmsProviderUpdateView.as_view(), name='admin-sms-provider-update'),

    # Remboursements
    path('refunds', views.RefundListAdminView.as_view(), name='admin-refunds'),
    path('refunds/<uuid:refund_id>/<str:action>', views.RefundActionAdminView.as_view(), name='admin-refund-action'),

    # Retraits chauffeurs
    path('withdrawals', views.WithdrawalListAdminView.as_view(), name='admin-withdrawals'),
    path('withdrawals/<uuid:withdrawal_id>/<str:action>', views.WithdrawalActionAdminView.as_view(), name='admin-withdrawal-action'),

    # Finance
    path('finance/summary', views.FinanceSummaryView.as_view(), name='admin-finance-summary'),
    path('finance/daily', views.FinanceDailyView.as_view(), name='admin-finance-daily'),
    path('finance/export', views.FinanceExportView.as_view(), name='admin-finance-export'),
]
