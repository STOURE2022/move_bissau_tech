"""Vues API pour les notations."""
from django.db.models import Avg
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ratings.models import Rating
from apps.rides.models import Ride
from core.config_service import get_config_int

from .serializers import RatingCreateSerializer, RatingSerializer


class RatingCreateView(APIView):
    """POST /api/ratings — Noter une course."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RatingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            ride = Ride.objects.get(id=data['ride_id'], status='paid')
        except Ride.DoesNotExist:
            return Response(
                {'error': 'Course introuvable ou pas encore payée.'},
                status=status.HTTP_404_NOT_FOUND
            )

        user = request.user

        # Vérifier que l'utilisateur est impliqué
        if user != ride.passenger and user != ride.driver.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Vérifier la fenêtre de notation
        window_hours = get_config_int('rating_window_hours', 24)
        if ride.paid_at and (timezone.now() - ride.paid_at).total_seconds() > window_hours * 3600:
            return Response(
                {'error': 'La fenêtre de notation est expirée.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Vérifier qu'il n'a pas déjà noté
        if Rating.objects.filter(ride=ride, from_user=user).exists():
            return Response(
                {'error': 'Vous avez déjà noté cette course.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Déterminer qui est noté
        if user == ride.passenger:
            to_user = ride.driver.user
            role = 'passenger'
        else:
            to_user = ride.passenger
            role = 'driver'

        rating = Rating.objects.create(
            ride=ride,
            from_user=user,
            to_user=to_user,
            role=role,
            score=data['score'],
            comment=data.get('comment', ''),
        )

        # Mettre à jour la moyenne du chauffeur
        if to_user.role == 'driver' and hasattr(to_user, 'driver_profile'):
            driver = to_user.driver_profile
            avg = Rating.objects.filter(
                to_user=to_user
            ).order_by('-created_at')[:100].aggregate(
                avg_score=Avg('score')
            )['avg_score']
            if avg:
                driver.average_rating = round(avg, 2)
                driver.save(update_fields=['average_rating'])

        return Response(RatingSerializer(rating).data, status=status.HTTP_201_CREATED)


class MyRatingsView(APIView):
    """GET /api/ratings/my-ratings — Mes notations reçues."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ratings = Rating.objects.filter(
            to_user=request.user
        ).order_by('-created_at')[:50]
        return Response(RatingSerializer(ratings, many=True).data)
