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

# Uvicorn direct (1 seul process = moins de mémoire)
print(f"Starting uvicorn on 0.0.0.0:{port}...", flush=True)
import uvicorn
uvicorn.run(
    'config.asgi:application',
    host='0.0.0.0',
    port=int(port),
    log_level='info',
    access_log=True,
)
