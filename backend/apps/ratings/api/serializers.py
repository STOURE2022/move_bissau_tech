"""Serializers pour les notations."""
from rest_framework import serializers

from apps.ratings.models import Rating


class RatingCreateSerializer(serializers.Serializer):
    """Création d'une notation."""
    ride_id = serializers.UUIDField()
    score = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=500, required=False, default='')


class RatingSerializer(serializers.ModelSerializer):
    from_user_name = serializers.SerializerMethodField()

    class Meta:
        model = Rating
        fields = ['id', 'ride_id', 'from_user_name', 'role', 'score', 'comment', 'created_at']

    def get_from_user_name(self, obj):
        return f"{obj.from_user.first_name} {obj.from_user.last_name[0]}."
