"""Script de démarrage pour Railway."""
import os
import subprocess
import sys

port = os.environ.get('PORT', '8000')
db_url = 'OK' if os.environ.get('DATABASE_URL') else 'MISSING'

print(f"=== MoveBissau Starting ===")
print(f"PORT={port} DATABASE_URL={db_url}")
print(f"SETTINGS={os.environ.get('DJANGO_SETTINGS_MODULE', 'NOT SET')}")

# Migrations
print("Running migrations...")
subprocess.run([sys.executable, 'manage.py', 'migrate', '--noinput'], check=False)

# Daphne
print(f"Starting daphne on port {port}...")
os.execvp('daphne', ['daphne', '-b', '0.0.0.0', '-p', port, 'config.asgi:application'])
