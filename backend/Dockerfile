FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    PYTHONPATH=/app

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

# Static collection only needs Django settings; runtime secrets are supplied by
# the Space at startup, so do not require them during the image build.
RUN DEBUG=true SECRET_KEY=build-only FRONTEND_URL=http://localhost:5173 python manage.py collectstatic --noinput

EXPOSE 7860

CMD ["bash", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-7860} --workers 1 --threads 4 --timeout 120 --access-logfile - --error-logfile -"]
