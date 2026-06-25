"""Vues API pour les incidents."""
from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.incidents.models import Incident
from apps.rides.models import Ride

from .serializers import IncidentCreateSerializer, IncidentSerializer


class IncidentCreateView(APIView):
    """POST /api/incidents — Signaler un incident."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = IncidentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ride = None
        if data.get('ride_id'):
            try:
                ride = Ride.objects.get(id=data['ride_id'])
            except Ride.DoesNotExist:
                pass

        location = None
        if data.get('latitude') and data.get('longitude'):
            location = Point(data['longitude'], data['latitude'], srid=4326)

        incident = Incident.objects.create(
            ride=ride,
            reported_by=request.user,
            incident_type=data['incident_type'],
            description=data['description'],
            location=location,
        )

        return Response(
            IncidentSerializer(incident).data,
            status=status.HTTP_201_CREATED
        )


class IncidentDetailView(APIView):
    """GET /api/incidents/<id> — Suivi d'un incident."""
    permission_classes = [IsAuthenticated]

    def get(self, request, incident_id):
        try:
            incident = Incident.objects.get(
                id=incident_id, reported_by=request.user
            )
        except Incident.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(IncidentSerializer(incident).data)
