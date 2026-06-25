"""URLs pour les commissions."""
from django.urls import path

from . import views

urlpatterns = [
    path('balance', views.CreditBalanceView.as_view(), name='credit-balance'),
    path('topup', views.CreditTopupView.as_view(), name='credit-topup'),
    path('transactions', views.CreditTransactionsView.as_view(), name='credit-transactions'),
    path('withdraw', views.WithdrawalRequestView.as_view(), name='withdrawal-request'),
    path('withdrawals', views.WithdrawalListView.as_view(), name='withdrawal-list'),
]
