# DailyFuel API

Python 3.12+, Django 5.2 LTS, Django REST Framework, PostgreSQL. SQLite is deliberately unsupported.

Create a PostgreSQL role and database (the role needs CREATEDB for tests):

```sql
CREATE USER dailyfuel WITH PASSWORD 'dailyfuel' CREATEDB;
CREATE DATABASE dailyfuel OWNER dailyfuel;
```

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
mkdir -p private-media
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

For the frontend, copy `frontend/.env.example` to `frontend/.env.local` when the API is not on port 8000. Vite reads `DAILYFUEL_API_URL` for its `/api` and `/accounts` development proxy.

Generate a development secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Never commit `.env`, `.env.local`, OAuth secrets, SMTP passwords, or production database credentials.

Set a unique secret, PostgreSQL connection URL, hosts, HTTPS frontend/CSRF origins, SMTP, Google credentials and private storage in production. DEBUG=false enables HTTPS redirects and secure cookies. The frontend development proxy forwards API and `/accounts/` routes to Django so session and CSRF cookies remain same-origin. POST/PATCH/PUT/DELETE require the `X-CSRFToken` header from `GET /api/v1/auth/csrf/`; authentication does not exempt anonymous login and registration from CSRF checks.

Google uses django-allauth and requires Google web OAuth credentials; register `/accounts/google/login/callback/` on the backend origin. Login starts with a CSRF-protected POST to `/accounts/google/login/`. It is disabled in the UI until both credentials are configured. Console email is development-only; SMTP is required for deployed password reset delivery.
