"""Script de démarrage pour Railway."""
import os
import subprocess
import sys
import traceback

# Force unbuffered output pour voir les logs en temps réel
os.environ['PYTHONUNBUFFERED'] = '1'

port = os.environ.get('PORT', '8000')
db_url = 'OK' if os.environ.get('DATABASE_URL') else 'MISSING'
redis_url = 'OK' if os.environ.get('REDIS_URL') else 'MISSING'

print(f"=== MoveBissau Starting ===", flush=True)
print(f"PORT={port}", flush=True)
print(f"DATABASE_URL={db_url}", flush=True)
print(f"REDIS_URL={redis_url}", flush=True)
print(f"SETTINGS={os.environ.get('DJANGO_SETTINGS_MODULE', 'NOT SET')}", flush=True)

# Migrations
print("Running migrations...", flush=True)
result = subprocess.run(
    [sys.executable, 'manage.py', 'migrate', '--noinput'],
    capture_output=False,
)
print(f"Migrations exit code: {result.returncode}", flush=True)

# Tester l'import de l'application ASGI avant de lancer daphne
print("Testing ASGI application import...", flush=True)
try:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.railway')
    import django
    django.setup()
    from config.asgi import application
    print("ASGI application imported successfully!", flush=True)
except Exception as e:
    print(f"FATAL: Failed to import ASGI application: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)

# Daphne
print(f"Starting daphne on 0.0.0.0:{port}...", flush=True)
os.execvp('daphne', [
    'daphne',
    '-b', '0.0.0.0',
    '-p', port,
    '--verbosity', '2',
    'config.asgi:application',
])
