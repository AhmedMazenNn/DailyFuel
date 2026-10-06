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

Macros are `{calories,protein,fat}`. Meal draft is `{name,mode:'quick'|'itemized',note,totals:Macros,items:[{id?,name,calories,protein,fat}]}`. In itemized mode only item macros count. Meals return `{id,date,name,mode,note,totals,items,createdAt,position}`.

- GET/PUT `nutrition-days/{date}/`: `{date,targets,totals,remaining,meals,nextMealNumber}`. PUT accepts `{targets:Macros}`. GET never creates rows. All mutations reconcile from server day response.
- GET/POST `nutrition-days/{date}/meals/`: list/create; POST returns Meal, supports `Idempotency-Key`.
- GET/PATCH/DELETE `meals/{id}/`: PATCH accepts complete draft or partial fields, returns Meal.
- POST `nutrition-days/{date}/meals/reorder/`: `{ids:[...]}`.
- POST `meals/{id}/items/`; PATCH/DELETE `meal-items/{id}/`; POST `meals/{id}/items/reorder/` `{ids:[...]}`.
- GET `history/?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1`: `{results:[Day],count,next,previous}` (31 days per page; saved days only).
- GET `gamification/`: `{xp,level,levelProgress,xpToNext,streak,longestStreak,loggedDays,earned:[code]}`. Codes `first`, `seven`, `thirty`; logging only, 10 XP per date, 100 XP per level. Past earned XP persists after deletion. Future dates do not reward until they become current; active streak derives from currently logged dates up to today, ending today or yesterday.

Backend nutrition exposes `nutrition.models.NutritionDay` and `Meal`; gamification implemented in nutrition app to transact with meal mutation.

## Progress

WeeklyRecord `{weekStart,weightKg,measuredOn,note,photos:[{id,url,thumbnailUrl,label,note,capturedOn}]}`. Weeks start Monday. Weight normalized kg. Auth required for every image byte.

- GET `progress/weeks/?page=1`: paginated `{results:[WeeklyRecord],count,next,previous}` (26 weeks).
- GET `progress/weeks/{week_start}/`: WeeklyRecord, empty preview if absent.
- GET/PUT `progress/weeks/{week_start}/weight/`: PUT `{weightKg,measuredOn?,note?}`, returns WeeklyRecord.
- GET/POST `progress/weeks/{week_start}/photos/`: POST multipart `image,label?,note?,capturedOn?`, returns Photo. Four-photo transaction limit, requires weight. JPEG/PNG/WebP max configurable 10MB; actual content verified, metadata stripped.
- PATCH/DELETE `progress/photos/{id}/`: editable label/note/capturedOn.
- GET `progress/photos/{id}/file/` and `thumbnail/`: private authenticated image responses.

Backend progress app exposes durable media deletion jobs and cleanup management command. Account deletion uses progress cleanup service, never public media routes.
