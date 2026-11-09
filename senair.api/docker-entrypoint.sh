#!/bin/sh
# Rôles : api (migrations + données de référence + gunicorn), stream (consommateur Kafka), ou toute commande manage.py.
set -e
case "$1" in
  api)
    python manage.py migrate --noinput
    python manage.py seed_reference
    exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers "${GUNICORN_WORKERS:-3}" --timeout 60 --access-logfile -
    ;;
  stream)
    exec python manage.py consume_stream
    ;;
  *)
    exec python manage.py "$@"
    ;;
esac
