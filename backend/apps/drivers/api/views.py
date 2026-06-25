"""Vues API pour les chauffeurs."""
import logging
import uuid

from django.conf import settings
from django.contrib.gis.geos import Point
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.commissions.services.commission_service import get_or_create_credit
from apps.drivers.models import Driver, DriverDocument, Vehicle
from core.permissions import IsDriver

from .serializers import (
    DriverDocumentSerializer,
    DriverProfileSerializer,
    DriverRegistrationSerializer,
    LocationUpdateSerializer,
    VehicleSerializer,
)

logger = logging.getLogger(__name__)


class DriverRegisterView(APIView):
    """POST /api/drivers/register — Inscription comme chauffeur."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DriverRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if hasattr(user, 'driver_profile'):
            return Response(
                {'error': 'Vous êtes déjà inscrit comme chauffeur.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.role = 'driver'
        user.save(update_fields=['role'])

        driver = Driver.objects.create(
            user=user,
            vehicle_type=serializer.validated_data['vehicle_type'],
            license_number=serializer.validated_data.get('license_number', ''),
        )

        get_or_create_credit(driver)

        return Response(
            DriverProfileSerializer(driver).data,
            status=status.HTTP_201_CREATED
        )


class DriverProfileView(APIView):
    """GET/PATCH /api/drivers/me — Profil du chauffeur courant."""
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        driver = request.user.driver_profile
        return Response(DriverProfileSerializer(driver).data)

    def patch(self, request):
        """Mise à jour partielle du profil chauffeur."""
        driver = request.user.driver_profile
        allowed = ['vehicle_type', 'license_number']
        for field in allowed:
            if field in request.data:
                setattr(driver, field, request.data[field])
        driver.save()

        # Mettre à jour aussi le user (avatar, nom...)
        user = request.user
        user_fields = ['first_name', 'last_name', 'avatar_url']
        updated = []
        for field in user_fields:
            if field in request.data:
                setattr(user, field, request.data[field])
                updated.append(field)
        if updated:
            user.save(update_fields=updated)

        return Response(DriverProfileSerializer(driver).data)


class DriverAvatarUploadView(APIView):
    """POST /api/drivers/avatar — Upload photo de profil."""
    permission_classes = [IsAuthenticated, IsDriver]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('avatar')
        if not file:
            return Response({'error': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        # En dev, sauvegarder localement. En prod, MinIO/S3.
        ext = file.name.split('.')[-1] if '.' in file.name else 'jpg'
        filename = f"avatars/{uuid.uuid4().hex}.{ext}"

        if settings.DEBUG:
            import os
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'avatars')
            os.makedirs(upload_dir, exist_ok=True)
            filepath = os.path.join(settings.MEDIA_ROOT, filename)
            with open(filepath, 'wb') as f:
                for chunk in file.chunks():
                    f.write(chunk)
            url = f"/media/{filename}"
        else:
            # En prod, utiliser le storage S3/MinIO
            from django.core.files.storage import default_storage
            path = default_storage.save(filename, file)
            url = default_storage.url(path)

        request.user.avatar_url = url
        request.user.save(update_fields=['avatar_url'])

        return Response({'avatar_url': url})


class DriverDocumentUploadView(APIView):
    """POST /api/drivers/documents — Upload d'un document."""
    permission_classes = [IsAuthenticated, IsDriver]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        """Liste les documents du chauffeur."""
        docs = DriverDocument.objects.filter(
            driver=request.user.driver_profile
        ).order_by('doc_type')
        return Response(DriverDocumentSerializer(docs, many=True).data)

    def post(self, request):
        doc_type = request.data.get('doc_type')
        if not doc_type:
            return Response({'error': 'Type de document requis.'}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES.get('file')
        driver = request.user.driver_profile

        if file:
            # Upload du fichier
            ext = file.name.split('.')[-1] if '.' in file.name else 'jpg'
            filename = f"documents/{driver.id}/{doc_type}_{uuid.uuid4().hex[:8]}.{ext}"

            if settings.DEBUG:
                import os
                upload_dir = os.path.join(settings.MEDIA_ROOT, 'documents', str(driver.id))
                os.makedirs(upload_dir, exist_ok=True)
                filepath = os.path.join(settings.MEDIA_ROOT, filename)
                with open(filepath, 'wb') as f:
                    for chunk in file.chunks():
                        f.write(chunk)
                file_url = f"/media/{filename}"
            else:
                from django.core.files.storage import default_storage
                path = default_storage.save(filename, file)
                file_url = default_storage.url(path)
        else:
            file_url = request.data.get('file_url', '')

        if not file_url:
            return Response({'error': 'Fichier ou URL requis.'}, status=status.HTTP_400_BAD_REQUEST)

        # Créer ou remplacer le document
        doc, created = DriverDocument.objects.update_or_create(
            driver=driver,
            doc_type=doc_type,
            defaults={
                'file_url': file_url,
                'status': 'pending',
                'rejection_reason': '',
            }
        )

        return Response(
            DriverDocumentSerializer(doc).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class DriverSubmitVerificationView(APIView):
    """POST /api/drivers/submit-verification — Soumettre le dossier pour validation."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        driver = request.user.driver_profile

        # Vérifier que les documents essentiels sont présents
        required_docs = ['identity', 'license', 'insurance', 'vehicle_registration', 'criminal_record']
        existing = set(
            DriverDocument.objects.filter(
                driver=driver
            ).values_list('doc_type', flat=True)
        )

        missing = [d for d in required_docs if d not in existing]
        if missing:
            labels = {
                'identity': "Pièce d'identité",
                'license': 'Permis de conduire',
                'insurance': 'Assurance',
                'criminal_record': 'Casier judiciaire',
                'vehicle_registration': 'Carte grise',
            }
            missing_labels = [labels.get(d, d) for d in missing]
            return Response(
                {'error': f"Documents manquants : {', '.join(missing_labels)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Marquer le chauffeur comme en attente de vérification
        driver.verification_status = 'pending'
        driver.save(update_fields=['verification_status'])

        # Remettre tous les documents en pending
        DriverDocument.objects.filter(driver=driver).update(status='pending')

        return Response({
            'status': 'pending',
            'message': 'Votre dossier a été soumis. Vous serez notifié une fois validé.',
        })


class DriverVehicleView(APIView):
    """GET/POST/PATCH /api/drivers/vehicle — Gérer le véhicule."""
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        vehicles = Vehicle.objects.filter(driver=request.user.driver_profile, is_active=True)
        return Response(VehicleSerializer(vehicles, many=True).data)

    def post(self, request):
        """Créer ou mettre à jour le véhicule."""
        driver = request.user.driver_profile
        data = request.data

        vehicle, created = Vehicle.objects.update_or_create(
            driver=driver,
            is_active=True,
            defaults={
                'vehicle_type': data.get('vehicle_type', driver.vehicle_type),
                'brand': data.get('brand', ''),
                'model': data.get('model', ''),
                'color': data.get('color', ''),
                'plate_number': data.get('plate_number', ''),
                'year': data.get('year'),
            }
        )

        # Synchroniser le type de véhicule
        if 'vehicle_type' in data:
            driver.vehicle_type = data['vehicle_type']
            driver.save(update_fields=['vehicle_type'])

        return Response(VehicleSerializer(vehicle).data,
                       status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class DriverGoOnlineView(APIView):
    """POST /api/drivers/go-online."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        driver = request.user.driver_profile

        if not driver.is_verified:
            return Response(
                {'error': 'Vos documents doivent être validés avant de vous mettre en ligne.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if driver.forced_offline_until and timezone.now() < driver.forced_offline_until:
            remaining = (driver.forced_offline_until - timezone.now()).seconds // 60
            return Response(
                {'error': f'Vous êtes temporairement hors ligne. Réessayez dans {remaining} minutes.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not get_or_create_credit(driver).has_sufficient_credit:
            return Response(
                {'error': 'Crédit commission insuffisant. Rechargez votre crédit.'},
                status=status.HTTP_403_FORBIDDEN
            )

        driver.is_online = True
        driver.save(update_fields=['is_online', 'updated_at'])
        return Response({'is_online': True})


class DriverGoOfflineView(APIView):
    """POST /api/drivers/go-offline."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        driver = request.user.driver_profile
        driver.is_online = False
        driver.save(update_fields=['is_online', 'updated_at'])
        return Response({'is_online': False})


class DriverLocationUpdateView(APIView):
    """POST /api/drivers/location."""
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = LocationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        driver = request.user.driver_profile
        driver.current_location = Point(
            serializer.validated_data['longitude'],
            serializer.validated_data['latitude'],
            srid=4326
        )
        driver.location_updated_at = timezone.now()
        driver.save(update_fields=['current_location', 'location_updated_at'])

        request.user.last_location = driver.current_location
        request.user.last_location_at = driver.location_updated_at
        request.user.save(update_fields=['last_location', 'last_location_at'])

        return Response({'status': 'ok'})
