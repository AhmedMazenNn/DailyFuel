# Hugging Face Space deployment

DailyFuel can run as a Docker Space. The existing `render.yaml` remains available
for rollback, but the Space must build this repository (or a mirror containing
the root `Dockerfile`), not the unrelated `AhmedMazen/DjangoMart` application.

## Space settings

Create a Docker Space and set these variables in **Settings → Variables and
secrets**:

- `DEBUG=false`
- `SECRET_KEY` — a long random secret
- `DATABASE_URL` — the existing Neon PostgreSQL URL
- `DATABASE_DISABLE_SERVER_SIDE_CURSORS=true` when using Neon’s pooled URL
- `FRONTEND_URL` — the deployed frontend HTTPS URL
- `ALLOWED_HOSTS` — include the Space hostname, for example
  `ahmedmazen-dailyfuel.hf.space`
- `CSRF_TRUSTED_ORIGINS` — include `https://ahmedmazen-dailyfuel.hf.space`
  and the frontend URL
- `PRIVATE_MEDIA_BACKEND=s3` plus the existing S3-compatible storage variables
- email, Google OAuth, and other optional variables from `backend/.env.example`

HF routes the public Space URL to the container’s port `7860`; this is already
the default in the root Dockerfile. The container runs migrations before
Gunicorn starts and uses one worker to fit the free CPU/memory limits.

## Important free-tier limitation

Space storage is not a durable database or media volume. Keep PostgreSQL and
private photos in external persistent services. Do not use `PRIVATE_MEDIA_BACKEND=local`
for production photos. Free Spaces may sleep when idle, so the first request
after inactivity can still be slower, but the process remains managed by HF
instead of a short-lived Render free service.

## Frontend change

Set the frontend’s production API URL to:

```text
https://<space-owner>-<space-name>.hf.space
```

Do not include `/api`; the client already prefixes API routes as configured in
`frontend/.env.example`.
