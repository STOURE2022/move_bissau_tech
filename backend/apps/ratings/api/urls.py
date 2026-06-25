"""URLs pour les notations."""
from django.urls import path

from . import views

urlpatterns = [
    path('', views.RatingCreateView.as_view(), name='rating-create'),
    path('my-ratings', views.MyRatingsView.as_view(), name='my-ratings'),
]
