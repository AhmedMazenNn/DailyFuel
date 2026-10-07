#!/usr/bin/env bash
set -euo pipefail
python manage.py migrate --noinput
python manage.py cleanup_private_media --limit 100
# Keep request URLs (including private photo identifiers and reset queries) out of logs.
export GUNICORN_CMD_ARGS=""
exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-10000}" --workers 1 --threads 4 --timeout 120 --error-logfile -
