"""Vues API pour les notifications in-app et les tokens push."""
import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import DeviceToken, Notification

from .serializers import DeviceTokenSerializer, NotificationSerializer

logger = logging.getLogger(__name__)


class DeviceTokenView(APIView):
    """
    POST /api/notifications/device-token — Enregistrer un token FCM.
    DELETE /api/notifications/device-token — Désactiver un token (logout).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Un token identifie un appareil : s'il change de compte
        # (déconnexion/reconnexion), on le rattache au nouvel utilisateur.
        DeviceToken.objects.update_or_create(
            token=data['token'],
            defaults={
                'user': request.user,
                'platform': data['platform'],
                'is_active': True,
            },
        )
        return Response({'status': 'registered'}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        token = request.data.get('token')
        if not token:
            return Response(
                {'error': 'token requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        DeviceToken.objects.filter(
            token=token, user=request.user
        ).update(is_active=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationListView(APIView):
    """GET /api/notifications — Notifications in-app de l'utilisateur."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(
            user=request.user
        ).order_by('-created_at')[:50]

        unread_count = Notification.objects.filter(
            user=request.user, is_read=False
        ).count()

        return Response({
            'unread_count': unread_count,
            'results': NotificationSerializer(notifications, many=True).data,
        })


class NotificationMarkReadView(APIView):
    """
    POST /api/notifications/mark-read — Marquer comme lues.
    Body : {"ids": [...]} pour certaines, ou {} pour toutes.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        qs = Notification.objects.filter(user=request.user, is_read=False)
        ids = request.data.get('ids')
        if ids:
            qs = qs.filter(id__in=ids)

        updated = qs.update(is_read=True, read_at=timezone.now())
        return Response({'marked_read': updated})
