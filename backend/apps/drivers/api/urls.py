"""URLs pour les chauffeurs."""
from django.urls import path

from . import views

urlpatterns = [
    path('register', views.DriverRegisterView.as_view(), name='driver-register'),
    path('me', views.DriverProfileView.as_view(), name='driver-profile'),
    path('avatar', views.DriverAvatarUploadView.as_view(), name='driver-avatar'),
    path('documents', views.DriverDocumentUploadView.as_view(), name='driver-documents'),
    path('vehicle', views.DriverVehicleView.as_view(), name='driver-vehicle'),
    path('vehicle/photo', views.VehiclePhotoUploadView.as_view(), name='driver-vehicle-photo'),
    path('submit-verification', views.DriverSubmitVerificationView.as_view(), name='driver-submit-verification'),
    path('go-online', views.DriverGoOnlineView.as_view(), name='driver-go-online'),
    path('go-offline', views.DriverGoOfflineView.as_view(), name='driver-go-offline'),
    path('location', views.DriverLocationUpdateView.as_view(), name='driver-location'),
    path('nearby', views.NearbyDriversView.as_view(), name='nearby-drivers'),
]
