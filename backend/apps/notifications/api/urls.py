"""URLs pour les notifications."""
from django.urls import path

from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notification-list'),
    path('mark-read', views.NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('device-token', views.DeviceTokenView.as_view(), name='device-token'),
]
