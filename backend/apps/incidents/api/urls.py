"""URLs pour les incidents."""
from django.urls import path

from . import views

urlpatterns = [
    path('', views.IncidentCreateView.as_view(), name='incident-create'),
    path('<uuid:incident_id>', views.IncidentDetailView.as_view(), name='incident-detail'),
]
