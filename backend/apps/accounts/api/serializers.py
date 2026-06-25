"""Serializers pour l'authentification et les profils utilisateurs."""
import re

from django.contrib.auth import authenticate
from rest_framework import serializers

from apps.accounts.models import User

PHONE_REGEX = re.compile(r'^\+\d{7,15}$')  # Format international générique


class RegisterSerializer(serializers.Serializer):
    """Inscription par téléphone + mot de passe."""
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(min_length=6, max_length=128)
    password_confirm = serializers.CharField(min_length=6, max_length=128)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    role = serializers.ChoiceField(choices=['passenger', 'driver'], default='passenger')
    preferred_lang = serializers.ChoiceField(choices=['fr', 'pt', 'gcr'], default='fr')

    def validate_phone(self, value):
        value = value.strip().replace(' ', '')
        if not PHONE_REGEX.match(value):
            raise serializers.ValidationError(
                "Format invalide. Utilisez l'indicatif pays suivi du numéro (ex: +245955123456)."
            )
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("Ce numéro est déjà utilisé.")
        return value

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Le mot de passe doit contenir au moins 6 caractères.")
        if value.isdigit():
            raise serializers.ValidationError("Le mot de passe ne peut pas être entièrement numérique.")
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Les mots de passe ne correspondent pas.'})
        return data


class LoginSerializer(serializers.Serializer):
    """Connexion par téléphone + mot de passe."""
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(max_length=128)

    def validate_phone(self, value):
        value = value.strip().replace(' ', '')
        if not PHONE_REGEX.match(value):
            raise serializers.ValidationError(
                "Format invalide. Le numéro doit commencer par + suivi de chiffres."
            )
        return value


class OTPRequestSerializer(serializers.Serializer):
    """Demande d'envoi de code OTP."""
    phone = serializers.CharField(max_length=20, help_text="Numéro au format +245XXXXXXX")


class OTPVerifySerializer(serializers.Serializer):
    """Vérification du code OTP."""
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)


class CompleteProfileSerializer(serializers.Serializer):
    """Complétion du profil après première connexion."""
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    preferred_lang = serializers.ChoiceField(
        choices=['fr', 'pt', 'gcr'], default='fr'
    )
    role = serializers.ChoiceField(
        choices=['passenger', 'driver'], default='passenger'
    )


class UserSerializer(serializers.ModelSerializer):
    """Serializer du profil utilisateur."""
    has_unpaid_cancellation = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'phone', 'phone_verified', 'role',
            'first_name', 'last_name', 'email',
            'preferred_lang', 'avatar_url',
            'cancellation_debt', 'has_unpaid_cancellation',
            'created_at',
        ]
        read_only_fields = ['id', 'phone', 'phone_verified', 'role', 'created_at']


class UserUpdateSerializer(serializers.ModelSerializer):
    """Mise à jour du profil."""
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'preferred_lang', 'avatar_url']


class LanguageSerializer(serializers.Serializer):
    """Changement de langue."""
    preferred_lang = serializers.ChoiceField(choices=['fr', 'pt', 'gcr'])


class ForgotPasswordSerializer(serializers.Serializer):
    """Demande de réinitialisation — envoie un OTP."""
    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        value = value.strip().replace(' ', '')
        if not PHONE_REGEX.match(value):
            raise serializers.ValidationError("Format de numéro invalide.")
        if not User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("Aucun compte associé à ce numéro.")
        return value


class ResetPasswordSerializer(serializers.Serializer):
    """Réinitialisation du mot de passe avec OTP."""
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=6, max_length=128)
    new_password_confirm = serializers.CharField(min_length=6, max_length=128)

    def validate_phone(self, value):
        return value.strip().replace(' ', '')

    def validate_new_password(self, value):
        if value.isdigit():
            raise serializers.ValidationError("Le mot de passe ne peut pas être entièrement numérique.")
        return value

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Les mots de passe ne correspondent pas.'})
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """Changement de mot de passe (utilisateur connecté)."""
    current_password = serializers.CharField(max_length=128)
    new_password = serializers.CharField(min_length=6, max_length=128)
    new_password_confirm = serializers.CharField(min_length=6, max_length=128)

    def validate_new_password(self, value):
        if value.isdigit():
            raise serializers.ValidationError("Le mot de passe ne peut pas être entièrement numérique.")
        return value

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Les mots de passe ne correspondent pas.'})
        return data


class AdminResetPasswordSerializer(serializers.Serializer):
    """Réinitialisation par l'admin."""
    new_password = serializers.CharField(min_length=6, max_length=128)
