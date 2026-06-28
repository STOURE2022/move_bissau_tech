"""Crée un superuser admin à partir de variables d'environnement."""
import os

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Crée un superuser admin (idempotent, ne crée pas de doublon)'

    def handle(self, *args, **options):
        phone = os.environ.get('ADMIN_PHONE', '+245955000000')
        password = os.environ.get('ADMIN_PASSWORD', '')

        if not password:
            self.stderr.write("ADMIN_PASSWORD non défini, superuser non créé.")
            return

        if User.objects.filter(phone=phone).exists():
            user = User.objects.get(phone=phone)
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.role = 'admin'
            user.save()
            self.stdout.write(f"Admin {phone} mis à jour.")
        else:
            User.objects.create_superuser(
                phone=phone,
                password=password,
                first_name='Admin',
                last_name='MoveBissau',
            )
            self.stdout.write(f"Admin {phone} créé avec succès.")
