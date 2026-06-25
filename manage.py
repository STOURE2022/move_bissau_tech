#!/usr/bin/env python
"""
Proxy manage.py à la racine pour Railway.
Redirige vers backend/manage.py
"""
import os
import sys

if __name__ == '__main__':
    # Ajouter le dossier backend au path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.railway')

    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
