FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    PYTHONPATH=/app

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app

RUN python manage.py collectstatic --noinput

EXPOSE 7860

# Hugging Face Spaces supplies PORT=7860. Migrations are intentionally run at
# boot because the Space filesystem is rebuilt when a new image is deployed.
CMD ["bash", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-7860} --workers 1 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
