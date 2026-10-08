# Authentication email validation

Implemented for FR-01 on 2026-10-08: registration verification, authenticated resend, explicit EN/AR confirmation, shared Brevo delivery for verification and password recovery, and reset links while already signed in. Existing sign-in remains available before verification. No migrations.

Checks:
- Django accounts + notifications: 72 tests passed against isolated local PostgreSQL 16.
- Verification tests cover registration delivery, POST-only confirmation, CSRF, expiry, reuse, changed email, authentication and resend cooldown.
- Password reset tests cover delivery, password replacement, token reuse and generic responses on unknown accounts/provider failure.
- Existing Brevo adapter tests cover HTTPS delivery and sanitized provider failures.
- Frontend production build passed; Vite reports the existing large bundle warning.
- Frontend tests: 7 passed (these cover existing nutrition helpers, not browser authentication interactions).
- Frontend lint: zero errors; existing SavedFoods hook dependency warning.
- Independent frontend/backend integration review completed; Arabic link language and reset cancellation navigation addressed.

Gaps: no live provider delivery, deployed browser smoke test, or deployment environment inspection. Cache cooldown is per process with the default cache. GitHub CLI authentication is invalid, preventing PR creation/merge against dev. Production delivery requires BREVO_API_KEY, a verified DEFAULT_FROM_EMAIL, correct FRONTEND_URL, and no conflicting EMAIL_BACKEND override.
