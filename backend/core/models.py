"""Modèle de base avec UUID et timestamps pour toutes les entités."""
import uuid

from django.db import models


class BaseModel(models.Model):
    """Modèle abstrait : UUID + timestamps automatiques."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
