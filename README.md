---
title: DailyFuel API
emoji: 🥗
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# DailyFuel

DailyFuel is a mobile-first nutrition tracker for calories, protein, and fat. It includes meal logging, date-based targets, private weekly weight and progress photos, English/Arabic localization, and email account recovery and reminders.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Django REST Framework
- Database: PostgreSQL
- Media: private local or S3-compatible storage
- Email: Brevo transactional API in production, console email locally

## Local development

1. Create PostgreSQL and configure `backend/.env` from `backend/.env.example`.
2. Install backend dependencies and run migrations:

   ```bash
   cd backend
   python -m venv .venv
   .venv/bin/pip install -r requirements.txt
   .venv/bin/python manage.py migrate
   .venv/bin/python manage.py runserver
   ```

3. Install and run the frontend in a second terminal:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

The backend requires PostgreSQL. Set `DEBUG=true` and a development `SECRET_KEY` for local use.

## Email configuration

Local development uses Django's console backend when `DEBUG=true`; email content is printed in the server terminal. Tests override this with Django's in-memory backend.

Production email uses Brevo:

```dotenv
EMAIL_BACKEND=accounts.email_backend.BrevoEmailBackend
BREVO_API_KEY=your-brevo-api-key
DEFAULT_FROM_EMAIL=DailyFuel <verified-sender@example.com>
WEEKLY_EMAIL_ENABLED=true
```

The sender address must be verified with Brevo. Weekly reminders require an opted-in and confirmed user. Process due reminders with:

```bash
cd backend
python manage.py send_weekly_reminders --dry-run
python manage.py send_weekly_reminders
```

Never commit API keys, SMTP passwords, database URLs, or reset links. Configure secrets in GitHub Actions, Hugging Face Spaces, or the production host.

## Checks

```bash
cd backend
.venv/bin/python manage.py test --noinput
cd ../frontend
npm test
npm run build
```

GitHub Actions runs the backend and frontend checks on pushes and pull requests. The weekly reminder workflow is separate from CI and requires production secrets.

## Documentation

- [Deployment and local setup](docs/deployment.md)
- [Product requirements](docs/prd.md)
- [Entity relationships](docs/erd.md)
- [API contract](docs/api-contract.md)
- [Development workflow](docs/development-workflow.md)

`main` contains the approved release. New work starts from `dev` on a feature branch, with pull requests targeting `dev`. Keep credentials, dependencies, and `design-reference/` out of Git.
