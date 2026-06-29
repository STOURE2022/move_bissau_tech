"""Vues API pour l'authentification et les profils utilisateurs."""
import logging
import os
import uuid

from django.conf import settings
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.accounts.services.otp_service import create_otp, verify_otp
from apps.commissions.services.commission_service import get_or_create_credit
from apps.drivers.models import Driver

from core.permissions import IsAdmin

from .serializers import (
    AdminResetPasswordSerializer,
    ChangePasswordSerializer,
    CompleteProfileSerializer,
    ForgotPasswordSerializer,
    LanguageSerializer,
    LoginSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

logger = logging.getLogger(__name__)


class OTPRequestView(APIView):
    """POST /api/auth/otp/request — Demande d'envoi de code OTP."""
    permission_classes = [AllowAny]
    throttle_scope = 'otp'

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data['phone']

        otp = create_otp(phone)

        # Envoyer le SMS (via tâche Celery en production)
        from apps.notifications.services.notification_service import send_otp_sms
        send_otp_sms(phone, otp.code)

        return Response(
            {'message': 'Code OTP envoyé par SMS.'},
            status=status.HTTP_201_CREATED
        )


class OTPVerifyView(APIView):
    """POST /api/auth/otp/verify — Vérification du code OTP, retourne les tokens JWT."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data['phone']
        code = serializer.validated_data['code']

        if not verify_otp(phone, code):
            return Response(
                {'error': 'Code OTP invalide ou expiré.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Créer ou récupérer l'utilisateur
        user, is_new = User.objects.get_or_create(
            phone=phone,
            defaults={'phone_verified': True}
        )
        if not is_new:
            user.phone_verified = True
            user.save(update_fields=['phone_verified'])

        # Générer les tokens JWT
        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'is_new_user': is_new,
        })


class RegisterView(APIView):
    """POST /api/auth/register — Inscription par téléphone + mot de passe."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects.create_user(
            phone=data['phone'],
            password=data['password'],
            role=data['role'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            preferred_lang=data['preferred_lang'],
            phone_verified=True,
        )

        # Si chauffeur, créer le profil
        if data['role'] == 'driver':
            driver, _ = Driver.objects.get_or_create(
                user=user,
                defaults={'vehicle_type': 'moto'}
            )
            get_or_create_credit(driver)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST /api/auth/login — Connexion par téléphone + mot de passe."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            user = User.objects.get(phone=data['phone'])
        except User.DoesNotExist:
            return Response(
                {'error': 'Numéro de téléphone ou mot de passe incorrect.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(data['password']):
            return Response(
                {'error': 'Numéro de téléphone ou mot de passe incorrect.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if user.is_banned:
            return Response(
                {'error': 'Votre compte a été suspendu.'},
                status=status.HTTP_403_FORBIDDEN
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class CompleteProfileView(APIView):
    """POST /api/auth/complete-profile — Complétion du profil après inscription."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CompleteProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user
        user.first_name = data['first_name']
        user.last_name = data['last_name']
        user.preferred_lang = data['preferred_lang']
        user.role = data['role']
        user.save(update_fields=[
            'first_name', 'last_name', 'preferred_lang', 'role'
        ])

        # Si c'est un chauffeur, créer le profil chauffeur
        if data['role'] == 'driver':
            driver, _ = Driver.objects.get_or_create(
                user=user,
                defaults={'vehicle_type': 'moto'}
            )
            # Créer le crédit commission
            get_or_create_credit(driver)

        return Response(UserSerializer(user).data)


class UserProfileView(APIView):
    """GET/PATCH /api/users/me — Profil de l'utilisateur courant."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangeLanguageView(APIView):
    """PATCH /api/users/me/language — Changer la langue préférée."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = LanguageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.preferred_lang = serializer.validated_data['preferred_lang']
        request.user.save(update_fields=['preferred_lang'])
        return Response({'preferred_lang': request.user.preferred_lang})


class AvatarUploadView(APIView):
    """POST /api/auth/avatar — Upload photo de profil (tous les rôles)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('avatar')
        if not file:
            return Response({'error': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        ext = file.name.rsplit('.', 1)[-1] if '.' in file.name else 'jpg'
        filename = f"avatars/{uuid.uuid4().hex}.{ext}"

        upload_dir = os.path.join(settings.MEDIA_ROOT, 'avatars')
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(settings.MEDIA_ROOT, filename)
        with open(filepath, 'wb') as f:
            for chunk in file.chunks():
                f.write(chunk)
        url = f"/media/{filename}"

        request.user.avatar_url = url
        request.user.save(update_fields=['avatar_url'])

        return Response({'avatar_url': url})


class ForgotPasswordView(APIView):
    """POST /api/auth/forgot-password — Envoie un OTP pour réinitialiser le mot de passe."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data['phone']

        otp = create_otp(phone)
        from apps.notifications.services.notification_service import send_otp_sms
        send_otp_sms(phone, otp.code)

        return Response({'message': 'Code de réinitialisation envoyé par SMS.'})


class ResetPasswordView(APIView):
    """POST /api/auth/reset-password — Réinitialise le mot de passe avec un code OTP."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if not verify_otp(data['phone'], data['code']):
            return Response(
                {'error': 'Code invalide ou expiré.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(phone=data['phone'])
        except User.DoesNotExist:
            return Response(
                {'error': 'Utilisateur introuvable.'},
                status=status.HTTP_404_NOT_FOUND
            )

        user.set_password(data['new_password'])
        user.save(update_fields=['password'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Mot de passe réinitialisé avec succès.',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class ChangePasswordView(APIView):
    """POST /api/auth/change-password — Changer son mot de passe (connecté)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if not request.user.check_password(data['current_password']):
            return Response(
                {'error': 'Mot de passe actuel incorrect.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        request.user.set_password(data['new_password'])
        request.user.save(update_fields=['password'])
        return Response({'message': 'Mot de passe modifié avec succès.'})


class AdminResetPasswordView(APIView):
    """POST /api/admin/users/<id>/reset-password — L'admin réinitialise le mot de passe."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])

        return Response({
            'message': f'Mot de passe réinitialisé pour {user.first_name} {user.last_name}.',
            'phone': user.phone,
        })


class ValidatePromoCodeView(APIView):
    """POST /api/auth/promo/validate — Valider un code promo."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.accounts.models_promo import PromoCode, PromoUsage

        code = request.data.get('code', '').strip().upper()
        ride_price = request.data.get('ride_price', 0)

        if not code:
            return Response({'error': 'Code requis.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            promo = PromoCode.objects.get(code=code)
        except PromoCode.DoesNotExist:
            return Response({'error': 'Code promo invalide.'}, status=status.HTTP_404_NOT_FOUND)

        if not promo.is_valid:
            return Response({'error': 'Ce code promo a expiré ou n\'est plus disponible.'}, status=status.HTTP_400_BAD_REQUEST)

        # Vérifier usage par utilisateur
        user_uses = PromoUsage.objects.filter(promo_code=promo, user=request.user).count()
        if user_uses >= promo.max_uses_per_user:
            return Response({'error': 'Vous avez déjà utilisé ce code promo.'}, status=status.HTTP_400_BAD_REQUEST)

        discount = promo.calculate_discount(ride_price) if ride_price else 0

        return Response({
            'valid': True,
            'code': promo.code,
            'description': promo.description,
            'discount_type': promo.discount_type,
            'discount_value': promo.discount_value,
            'discount_amount': discount,
            'new_price': max(0, ride_price - discount) if ride_price else None,
        })


class ReferralCodeView(APIView):
    """GET /api/auth/referral/code — Obtenir son code de parrainage."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.accounts.models_promo import generate_referral_code

        user = request.user
        # Le code de parrainage est basé sur l'ID utilisateur
        code = f"MB{str(user.id).replace('-', '')[:6].upper()}"

        return Response({
            'referral_code': code,
            'share_text': f"Rejoins MoveBissau avec mon code {code} et gagne 500 F CFA ! Télécharge l'app : https://movebissautech-production.up.railway.app",
        })


class ReferralStatsView(APIView):
    """GET /api/auth/referral/stats — Stats de parrainage."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.accounts.models_promo import Referral

        referrals = Referral.objects.filter(referrer=request.user)
        total = referrals.count()
        credited = referrals.filter(referrer_credited=True).count()
        total_bonus = credited * 500  # Configurable

        return Response({
            'total_referrals': total,
            'credited_referrals': credited,
            'total_bonus': total_bonus,
        })
