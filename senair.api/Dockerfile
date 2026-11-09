# Image de l'API SEN-AIR. Contexte de construction : racine du monorepo (pour embarquer docs/api et docs/stream).
#   docker build -f senair.api/Dockerfile -t senair-api .
FROM python:3.14-slim AS runtime

ARG WITH_ML=1
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OPENAPI_PATH=/app/contracts/api/openapi.yaml \
    STREAM_SCHEMAS_DIR=/app/contracts/stream \
    MEDIA_ROOT=/data/media

WORKDIR /app/senair.api
COPY senair.api/requirements*.txt ./
RUN pip install -r $([ "$WITH_ML" = "1" ] && echo requirements-ml.txt || echo requirements.txt)

COPY docs/api /app/contracts/api
COPY docs/stream /app/contracts/stream
COPY senair.api/ ./
RUN rm -rf .venv tests db.sqlite3 media \
    && DJANGO_DEBUG=1 python manage.py collectstatic --noinput -v0 \
    && useradd --system --uid 10001 --home /app senair \
    && mkdir -p /data/media && chown -R senair /data

USER senair
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["api"]
