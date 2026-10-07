# Weekly email reminders

Manage reminders in **Profile → Weekly email check-in**. They are off by default. Users choose a weekday, local time, timezone, and whether to include a photo reminder. Saving a timezone updates their profile; historical recorded dates stay unchanged.

## Free services

Use **Brevo Free** for transactional email over HTTPS: [300 sends per day](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), shared with confirmations and password resets. DailyFuel caps weekly reminder reservations at 200 per UTC day by default to leave headroom. This does not guarantee available provider quota. Confirmation requests are limited to one per user per hour.

The hourly worker uses **GitHub Actions** and the existing Neon database. Standard runners are [free for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions); this repository is public. Reassess charges if that changes. No additional always-running server is needed.

GitHub schedules are best effort. Runs at minute 17 each hour can be delayed or dropped; the chosen reminder time is not an exact delivery promise. GitHub [disables public-repository schedules after 60 days without repository activity](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Check Actions periodically and re-enable if disabled. Successful later runs catch up within the current week.

## Setup, in order

1. Create a free account at [Brevo](https://www.brevo.com/). Under **Settings → Senders, Domains & Dedicated IPs → Senders**, add and verify a sender. If you own a domain, authenticate it using Brevo's DNS records. Complete any required transactional-account activation. Use this verified address below, not `noreply@example.com`.
2. Under **Settings → SMTP & API → API Keys**, create an API key. Use the API key, not an SMTP password. Store it in the dashboards, never in Git or chat.
3. In the Render backend service's **Environment**, set:

   | Variable | Value |
   | --- | --- |
   | `EMAIL_BACKEND` | `accounts.email_backend.BrevoEmailBackend` |
   | `BREVO_API_KEY` | Your Brevo API key |
   | `DEFAULT_FROM_EMAIL` | `DailyFuel <your-verified-address>` |
   | `FRONTEND_URL` | `https://daily-fuel-pi.vercel.app` |
   | `WEEKLY_EMAIL_ENABLED` | `false` initially |
   | `WEEKLY_EMAIL_DAILY_LIMIT` | `200` |

   Keep the existing Neon `DATABASE_URL` and Django `SECRET_KEY`. Save and redeploy. Backend startup runs the new migrations.
4. In GitHub **DailyFuel → Settings → Secrets and variables → Actions → Secrets**, add repository secrets:

   | Secret | Value |
   | --- | --- |
   | `DATABASE_URL` | Same Neon connection URL as Render, including SSL options |
   | `DJANGO_SECRET_KEY` | The exact Render `SECRET_KEY`, not a newly generated key |
   | `BREVO_API_KEY` | Your Brevo API key |

   Backend and worker must share the Django key to validate email links; rotate both together.
5. On the GitHub **Variables** tab, add:

   | Variable | Value |
   | --- | --- |
   | `FRONTEND_URL` | `https://daily-fuel-pi.vercel.app` |
   | `DEFAULT_FROM_EMAIL` | Same verified sender as Render |
   | `WEEKLY_EMAIL_DAILY_LIMIT` | `200` |
   | `WEEKLY_EMAIL_ENABLED` | `false` initially |

6. Open **Actions → Weekly email reminders → Run workflow**. Select **main**, leave **dry_run checked**, and run. It should succeed with aggregate counts (usually `due: 0` initially). This checks connectivity/schema without sending or changing records; it does not verify Brevo delivery.
7. Set Render `WEEKLY_EMAIL_ENABLED=true` and redeploy. Sign into your own account, open **Profile → Weekly email check-in**, choose the correct timezone and a future day/time, enable reminders, and save. Open the email and press **Confirm weekly emails**. This is the real sender test. Check Brevo transactional logs and spam if it does not arrive. Failed sends retain pending settings; retries are limited to one an hour.
8. Set GitHub's variable `WEEKLY_EMAIL_ENABLED=true` to activate hourly sending. Manual runs with **dry_run unchecked** also send eligible reminders; leave it checked for inspection.
9. Check the next scheduled run and Brevo logs. Save this week's weight and optional photo to verify a due reminder is skipped. Test unsubscribing using the email link's button or Profile.

No Vercel environment changes are required. Public email action pages use the existing API proxy.

## Logic and safeguards

- Opt-in sends a confirmation valid for 48 hours. Weekly emails require confirmation. Opening links never changes settings: confirmation and unsubscribe require an explicit button and CSRF-protected POST, without needing sign-in.
- Confirmation schedules the next occurrence strictly in the future. Schedule changes use the next future occurrence. Daylight saving gaps move forward; repeated local times use the first occurrence.
- Weeks start Monday in the user's timezone. Skip when that week's weight exists and, if requested, at least one photo exists. Photos are optional. Emails contain no body photos, weight values, or nutrition records; they link to authenticated Progress.
- A database reservation commits before contacting Brevo. Unique user/week records and locks prevent overlapping workers sending a second accepted or uncertain weekly reminder. Consent, account status, email address, and completion are checked again just before sending.
- Explicit HTTP 4xx rejections can retry after an hour, up to three attempts that week. Timeouts, 5xx responses, and interrupted workers are uncertain and never automatically resent because Brevo might already have accepted them. This prevents duplicates but can miss delivery; an external provider and database cannot guarantee exactly-once delivery.
- Opt-out, deactivation, and changed email addresses stop delivery. Changed addresses need fresh confirmation. Deletion removes individual preferences and delivery records. Unsubscribe links remain valid until the next opt-in; disabling or replacing confirmation invalidates old confirmation links.

## Operations

Run `python manage.py send_weekly_reminders --limit 25`, or add `--dry-run` for read-only candidate counts. Dry runs do not contact Brevo or prove delivery. Logs contain aggregate counts only. Rejections and uncertain sends fail the workflow after printing counts so an operator can investigate.

Delivery records track `claimed`, `sent` (provider accepted, not proof of inbox arrival), `rejected`, `unknown`, or `skipped`. Claims older than 15 minutes become unknown during the next sending run. Investigate unknown results in provider logs; do not blindly clear records and resend. Daily limits conservatively count reservations, including canceled attempts. Default capacity is 25 candidates per hourly run; higher volumes need a capacity review.

To pause sending, set GitHub's `WEEKLY_EMAIL_ENABLED=false`; set Render's flag false too to stop new opt-ins and confirmations. Users can still unsubscribe. Restrict production workflow editing and keep credentials in dashboard secrets.

## API

- Authenticated `GET /api/v1/email-reminders/`: own preferences and service availability.
- Authenticated `PATCH /api/v1/email-reminders/`: optional `enabled`, `weekday` (Monday=0), `time` (`HH:MM`), IANA `timezone`, `includePhotos`.
- Authenticated `POST /api/v1/email-reminders/confirmation/`: fresh confirmation, hourly limit.
- Public CSRF-protected `POST /api/v1/email-reminders/confirm/` and `/unsubscribe/`: signed `token`. Invalid links receive a generic error without account information.

The scheduler runs the management command directly; there is no public cron endpoint.
