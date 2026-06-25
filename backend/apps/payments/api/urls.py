"""URLs pour les paiements."""
from django.urls import path

from . import views

urlpatterns = [
    path('initiate', views.InitiatePaymentView.as_view(), name='payment-initiate'),
    path('confirm-cash', views.ConfirmCashPaymentView.as_view(), name='payment-confirm-cash'),
    path('callback/<str:provider_name>', views.PaymentCallbackView.as_view(), name='payment-callback'),
    path('providers', views.ActiveProvidersView.as_view(), name='payment-providers'),
]
