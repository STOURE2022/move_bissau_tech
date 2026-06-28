"""Script de démarrage pour Railway."""
import os
import signal
import subprocess
import sys
import traceback

# Force unbuffered output pour voir les logs en temps réel
os.environ['PYTHONUNBUFFERED'] = '1'


def handle_signal(signum, frame):
    print(f"Received signal {signum} ({signal.Signals(signum).name})", flush=True)
    sys.exit(0)


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)

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

# Créer le superuser admin si ADMIN_PASSWORD est défini
if os.environ.get('ADMIN_PASSWORD'):
    print("Creating/updating admin user...", flush=True)
    subprocess.run(
        [sys.executable, 'manage.py', 'create_admin'],
        capture_output=False,
    )

# Tester l'import de l'application ASGI avant de lancer le serveur
print("Testing ASGI application import...", flush=True)
try:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.railway')
    import django
    django.setup()
    from config.asgi import application  # noqa: F401
    print("ASGI application imported successfully!", flush=True)
except Exception as e:
    print(f"FATAL: Failed to import ASGI application: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)

# Gunicorn WSGI (le plus simple et stable possible)
print(f"Starting gunicorn (WSGI) on 0.0.0.0:{port}...", flush=True)
os.execvp('gunicorn', [
    'gunicorn',
    'config.wsgi:application',
    '-b', f'0.0.0.0:{port}',
    '-w', '1',
    '--timeout', '120',
    '--access-logfile', '-',
    '--error-logfile', '-',
    '--log-level', 'info',
    '--preload',
])
