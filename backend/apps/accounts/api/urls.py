"""URLs pour l'authentification et les profils."""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # Authentification par mot de passe
    path('register', views.RegisterView.as_view(), name='register'),
    path('login', views.LoginView.as_view(), name='login'),
    path('token/refresh', TokenRefreshView.as_view(), name='token-refresh'),
    path('forgot-password', views.ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password', views.ResetPasswordView.as_view(), name='reset-password'),
    path('change-password', views.ChangePasswordView.as_view(), name='change-password'),

    # Ancien système OTP (gardé pour compatibilité)
    path('otp/request', views.OTPRequestView.as_view(), name='otp-request'),
    path('otp/verify', views.OTPVerifyView.as_view(), name='otp-verify'),
    path('complete-profile', views.CompleteProfileView.as_view(), name='complete-profile'),

    # Profil
    path('users/me', views.UserProfileView.as_view(), name='user-profile'),
    path('users/me/language', views.ChangeLanguageView.as_view(), name='change-language'),
    path('avatar', views.AvatarUploadView.as_view(), name='avatar-upload'),

    # Codes promo
    path('promo/validate', views.ValidatePromoCodeView.as_view(), name='validate-promo'),

    # Parrainage
    path('referral/code', views.ReferralCodeView.as_view(), name='referral-code'),
    path('referral/stats', views.ReferralStatsView.as_view(), name='referral-stats'),
]
