"""URLs pour les courses."""
from django.urls import path

from . import views

urlpatterns = [
    # Estimation
    path('estimate', views.PriceEstimateView.as_view(), name='price-estimate'),

    # Demandes
    path('requests/active', views.ActiveRideRequestView.as_view(), name='active-ride-request'),
    path('requests', views.RideRequestCreateView.as_view(), name='ride-request-create'),
    path('requests/<uuid:request_id>', views.RideRequestDetailView.as_view(), name='ride-request-detail'),
    path('requests/<uuid:request_id>/cancel', views.RideRequestCancelView.as_view(), name='ride-request-cancel'),
    path('requests/<uuid:request_id>/offers', views.RideRequestOffersView.as_view(), name='ride-request-offers'),
    path('requests/<uuid:request_id>/accept-offer', views.AcceptOfferView.as_view(), name='accept-offer'),
    path('requests/<uuid:request_id>/reject-offer', views.RejectOfferView.as_view(), name='reject-offer'),

    # Demandes disponibles pour les chauffeurs (polling)
    path('requests/nearby', views.NearbyRideRequestsView.as_view(), name='nearby-ride-requests'),

    # Offres chauffeur
    path('offers', views.RideOfferCreateView.as_view(), name='ride-offer-create'),
    path('offers/my-pending', views.MyPendingOffersView.as_view(), name='my-pending-offers'),
    path('offers/<uuid:offer_id>', views.RideOfferWithdrawView.as_view(), name='ride-offer-withdraw'),

    # Courses
    path('history', views.RideHistoryView.as_view(), name='ride-history'),
    path('<uuid:ride_id>', views.RideDetailView.as_view(), name='ride-detail'),
    path('<uuid:ride_id>/status', views.RideStatusUpdateView.as_view(), name='ride-status-update'),
    path('<uuid:ride_id>/cancel', views.RideCancelView.as_view(), name='ride-cancel'),
    path('<uuid:ride_id>/share', views.RideShareView.as_view(), name='ride-share'),
    path('<uuid:ride_id>/track/<str:token>', views.RideTrackPublicView.as_view(), name='ride-track'),
    path('<uuid:ride_id>/sos', views.RideSOSView.as_view(), name='ride-sos'),
]
