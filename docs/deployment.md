# Deploy DailyFuel: Render + Neon + Vercel

Deploy from `main`. The backend runs on Render's free web service, PostgreSQL stays in your existing Neon project, and Vercel serves the frontend. Photos require persistent **private** object storage; Render's free filesystem is temporary.

## 1. Prepare private photos and password-reset email

Create a free Supabase project for storage only; keep using Neon for the database. In Storage, create a bucket named `dailyfuel-private` with **Public bucket disabled**. In Storage settings, generate server-side S3 credentials and copy the S3 endpoint, region, access key ID and secret. These credentials belong only in Render, never Vercel or browser code. See [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication).

Create a Brevo account, verify your sender address, and generate an API key. Render's free service blocks SMTP ports, so DailyFuel sends reset email over HTTPS. Use `DailyFuel <your-verified-address@example.com>` for the sender. See [Brevo transactional email](https://developers.brevo.com/reference/send-transac-email).

If the Neon database already contains photo records, copy their original files and thumbnails from the existing `backend/private-media` folder into the bucket before launch. From your existing backend environment, set the S3 variables below and `PRIVATE_MEDIA_BACKEND=s3`, then run:

```bash
python manage.py migrate_private_media --source-dir /absolute/path/to/private-media --dry-run
python manage.py migrate_private_media --source-dir /absolute/path/to/private-media
```

This copies database-referenced files, checks their sizes, and retains the local originals. It refuses missing files or conflicting object sizes. A database alone does not contain the uploaded image files. Skip this step if there are no existing photos.

## 2. Create the Render service

In Render, choose **New → Blueprint**, connect `AhmedMazenNn/DailyFuel`, and select `main`. Render reads the repository's `render.yaml`. Select the free plan; no Render database is needed. Supply these environment values:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your Neon connection string, including `sslmode=require`; use the pooled endpoint if desired |
| `FRONTEND_URL` | Your intended Vercel production origin, e.g. `https://dailyfuel.vercel.app`, without a trailing path |
| `S3_ENDPOINT_URL` | Supabase's S3 endpoint copied from its dashboard |
| `S3_REGION_NAME` | Region shown with those credentials |
| `S3_BUCKET_NAME` | `dailyfuel-private` |
| `S3_ACCESS_KEY_ID` | Server-side S3 access key |
| `S3_SECRET_ACCESS_KEY` | Server-side S3 secret |
| `BREVO_API_KEY` | Brevo API key |
| `DEFAULT_FROM_EMAIL` | Your verified sender, e.g. `DailyFuel <sender@example.com>` |

The blueprint generates `SECRET_KEY`, enables production security, and configures persistent media and HTTPS email. Keep its generated secret stable across deployments. Builds install dependencies and collect static files; startup applies database migrations before serving requests. Back up an existing Neon database before its first production migration.

If you use **New → Web Service** instead, use branch `main`, root directory `backend`, Python runtime, free plan, build `bash build.sh`, start `bash start.sh`, and health path `/api/v1/health/`. Copy every environment setting from `render.yaml`; generate a strong persistent `SECRET_KEY` yourself.

After deployment, open `https://YOUR-SERVICE.onrender.com/api/v1/health/`; expect `{"status":"ok"}`. If this differs from `https://dailyfuel-4jtm.onrender.com`, update the backend destinations in `frontend/vercel.json` before deploying Vercel.

## 3. Deploy Vercel

Import the same GitHub repository. Set production branch `main`, root directory **`frontend`**, framework **Vite**, build command `npm run build`, and output directory `dist`.

The committed `frontend/vercel.json` points to `https://dailyfuel-4jtm.onrender.com` and proxies API, authentication, admin, and static requests to Render, supplies SPA routing, and disables caching of private responses. Cookies remain on the frontend origin; no cross-site cookie setup is required.

After Vercel assigns the actual production URL, update Render's `FRONTEND_URL` to that exact origin and redeploy Render. If your Render hostname changes, update the destinations in `frontend/vercel.json` and redeploy Vercel. Vercel preview domains are not automatically trusted for authentication; use the configured production domain for verification.

For optional Google sign-in, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Render. In Google OAuth configuration, use your Vercel origin as the authorized JavaScript origin and `https://YOUR-FRONTEND.vercel.app/accounts/google/login/callback/` as the redirect URI. Restart Render after setting the credentials.

## 4. Verify the live app

- Open the Vercel URL and `/api/v1/health/` through that URL; both must load.
- Register, sign out, sign in, and refresh a protected page; confirm the session persists.
- Request password reset and complete the emailed link.
- Save a food, add a consumed portion to a meal, and confirm calculated nutrition.
- Upload a weekly photo, open it full screen, compare photos, and delete/replace one.
- Redeploy Render and confirm a retained photo still loads. Check that its bucket has public access disabled and an unauthenticated photo API request is rejected.
- Check phone layout, dark mode, and Arabic.

[Render's free service](https://render.com/docs/free) sleeps after 15 minutes without traffic; the next API request can take about a minute. Photos survive restarts because they live in the private bucket. Free plans have provider quotas and are suitable for an initial small deployment.

## Local development and checks

Copy `backend/.env.example` to `backend/.env`, configure a local PostgreSQL database, install `backend/requirements.txt`, migrate, and run Django on port 8000. Run `npm ci` and `npm run dev` in `frontend`; Vite proxies requests to the backend. Local media storage and console email are the development defaults.

```bash
cd backend
python manage.py test
python manage.py makemigrations --check --dry-run
cd ../frontend
npm test
npm run build
```

Use an isolated local test database, not the production Neon database. Storage and transactional-email tests mock providers; production credentials and live deployments still require the checks above.

## Account administration

Open `https://daily-fuel-pi.vercel.app/admin/accounts/user/` using an active **superuser** account. Once signed in to the app, superusers also see **Manage accounts** beside the theme control. The admin console has its own sign-in form and uses the same account/session as the application.

To create the first administrator, run the following from your local backend environment with `DATABASE_URL` pointing to your existing Neon database. Use environment configuration for the connection string; do not commit it or share passwords in chat.

```bash
python manage.py createsuperuser
```

Enter a dedicated administrator email and a strong password at the prompts. This creates its profile automatically. Administrator privileges cannot be granted from public registration or the account-editing page. Keep administrator credentials separate from ordinary user credentials.

The user list supports email/name search, status filters, and pagination. Select a user to change their email, active status, display name, timezone, language, or weight unit, or use the password-change form. Disabling an ordinary account blocks sign-in and authenticated access without deleting its data. Email changes validate uniqueness and reset verification of the changed address.

Deleting an ordinary account requires reviewing its confirmation screen and permanently removes its associated application records. Original photos and thumbnails are queued for private-storage deletion; temporary storage failures leave durable retry jobs. Use `python manage.py cleanup_private_media` to retry pending jobs when needed. Bulk deletion and administrator-account deletion/deactivation are disabled. Administrator roles are read-only on this page. Django records successful edits, password changes, and deletions in its administration history; ordinary users cannot access this console.
