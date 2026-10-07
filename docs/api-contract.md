# API contract

All JSON routes use `/api/v1/`, Django session cookies and CSRF. Decimal database values are serialized as JSON numbers for the existing design; the server performs Decimal calculations. Errors use DRF field errors or `detail`. Dates are ISO local dates. PostgreSQL is mandatory.

## Accounts

- GET `auth/csrf/`: establishes CSRF cookie.
- GET `auth/session/`: `{user: null}` or `{user: {id, email}, profile: Settings}`.
- POST `auth/register/`: `{email,password,name}`; signs in and returns session payload.
- POST `auth/login/`: `{email,password}`; returns session payload.
- POST `auth/logout/`.
- POST `auth/password/reset/`: `{email}`; generic response, sends reset link.
- POST `auth/password/reset/confirm/`: `{uid,token,password}`.
- GET `auth/config/`: `{googleEnabled: boolean}`. Google uses maintained allauth OAuth routes under `/accounts/`.
- GET/PATCH `profile/`: Settings `{name,email,language,weightUnit,textSize,reduceMotion,showRewards,timezone,onboardingComplete,initialTargets:{calories,protein,fat}}`. email read-only. Initial targets explicitly entered, no recommendations. Name and preferences persist.
- DELETE `account/`: requires `{password}` (or recent authenticated session for OAuth-only account), removes records and schedules private-media deletion.

Backend accounts exposes `accounts.models.Profile` with `user` one-to-one (related_name `profile`), `timezone`, `initial_calories`, `initial_protein`, `initial_fat`, `onboarding_complete`. Use `settings.AUTH_USER_MODEL` for all relationships. Service `accounts.services.local_today(user)` returns user's current date.

## Nutrition

Saved foods are owner-scoped reusable definitions. `GET /saved-foods/?search=oat` lists active foods; `POST /saved-foods/`, `GET/PATCH/DELETE /saved-foods/{id}/` create, edit, and archive them. `POST /meals/{id}/items/from-saved-food/` accepts `{saved_food_id, amount_g}` and calculates Decimal nutrition on the server. The created item stores the food name, serving amount, consumed amount, and calculated nutrition snapshot. Carbohydrates are item detail only and are not added to daily targets or dashboard counters.

Macros are `{calories,protein,fat}`. Meal draft is `{name,mode:'quick'|'itemized',note,totals:Macros,items:[{id?,name,calories,protein,fat}]}`. In itemized mode only item macros count. Meals return `{id,date,name,mode,note,totals,items,createdAt,position}`.

- GET/PUT `nutrition-days/{date}/`: `{date,targets,totals,remaining,meals,nextMealNumber}`. PUT accepts `{targets:Macros}`. GET never creates rows. All mutations reconcile from server day response.
- GET/POST `nutrition-days/{date}/meals/`: list/create; POST returns Meal plus `day` and `gamification` snapshots, supports `Idempotency-Key`.
- GET/PATCH/DELETE `meals/{id}/`: PATCH accepts complete draft or partial fields, returns Meal plus `day` and `gamification` snapshots. DELETE returns 204.
- POST `nutrition-days/{date}/meals/reorder/`: `{ids:[...]}`.
- POST `meals/{id}/items/`; PATCH/DELETE `meal-items/{id}/`; POST `meals/{id}/items/reorder/` `{ids:[...]}`.
- GET `history/?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1`: `{results:[Day],count,next,previous}` (31 days per page; saved days only).
- GET `gamification/`: `{xp,level,levelProgress,xpToNext,streak,longestStreak,loggedDays,earned:[code]}`. Codes `first`, `seven`, `thirty`; logging only, 10 XP per date, 100 XP per level. Past earned XP persists after deletion. Future dates do not reward until they become current; active streak derives from currently logged dates up to today, ending today or yesterday.

Backend nutrition exposes `nutrition.models.NutritionDay` and `Meal`; gamification implemented in nutrition app to transact with meal mutation.

Meal save responses include the authoritative day totals, meals, and reward state in the same transaction. Clients should apply these snapshots without fetching the day and rewards again. An idempotent create retry retains the original Meal result but includes current day and gamification snapshots, so replay cannot roll the dashboard back to an earlier state.

## Progress

WeeklyRecord `{weekStart,weightKg,measuredOn,note,photos:[{id,url,thumbnailUrl,label,note,capturedOn}]}`. Weeks start Monday. Weight normalized kg. Auth required for every image byte.

- GET `progress/weeks/?page=1`: paginated `{results:[WeeklyRecord],count,next,previous}` (26 weeks).
- GET `progress/weeks/{week_start}/`: WeeklyRecord, empty preview if absent.
- GET/PUT `progress/weeks/{week_start}/weight/`: PUT `{weightKg,measuredOn?,note?}`, returns WeeklyRecord.
- GET/POST `progress/weeks/{week_start}/photos/`: POST multipart `image,label?,note?,capturedOn?`, returns Photo. Four-photo transaction limit, requires weight. JPEG/PNG/WebP max configurable 10MB; actual content verified, metadata stripped.
- PATCH/DELETE `progress/photos/{id}/`: editable label/note/capturedOn.
- GET `progress/photos/{id}/file/` and `thumbnail/`: private authenticated image responses.

Backend progress app exposes durable media deletion jobs and cleanup management command. Account deletion uses progress cleanup service, never public media routes.

## In-app administration

All `/api/v1/admin/` endpoints require an authenticated, active superuser. Staff flags or frontend visibility do not grant access. Session CSRF protection and private/no-store response caching apply.

- `GET admin/users/?search=&status=all&page=1`: paginated metadata (25 accounts per page), total filtered count, page/pages, and global total/active/inactive/administrator counts. Status accepts `all`, `active`, `inactive`, or `admin`; search matches name/email. Positive pages beyond the end clamp to the last page.
- `GET admin/users/{id}/`: account identity/status/preferences, timestamps, opaque `version`, counts of meals/foods/weeks/photos, and the last 20 account administration log entries. Password hashes, photo keys/images, weights, and nutrition values are excluded.
- `PATCH admin/users/{id}/`: requires the current `version`; accepts email, name, isActive, timezone, language, weightUnit, and optional `newPassword`. Unknown fields and privilege changes are rejected. Passwords use Django validation and are never returned/logged; self password changes preserve the current administrator session. Changed email addresses are normalized and synchronized with allauth without retaining verification from the previous address.
- `DELETE admin/users/{id}/`: requires current `version` and `confirmationEmail` exactly matching the current email. Deletes the account's associated data via the durable private-photo cleanup service and records the administration action.

Mutations lock account/profile rows and reject stale versions with HTTP 409. Invalid input or confirmation returns 400, unauthorized access 403, and missing accounts 404. Administrator deactivation/deletion and bulk deletion are unavailable. Administrator creation remains an operator task (`createsuperuser`).
