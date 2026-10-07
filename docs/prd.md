# DailyFuel — Product Requirements Document

**Status:** Ready for implementation planning\
**Product:** DailyFuel\
**Version:** 1.0\
**Primary clients:** Responsive web application\
**Frontend:** ReactJS\
**Backend:** Django REST API\
**Database:** PostgreSQL (recommended implementation default)

## 1. Product overview

DailyFuel is a mobile-first nutrition tracking app. Its home page makes calories consumed versus the user's daily target the dominant element, with protein, carbohydrates, and fat shown as supporting counters. Users manually record meals and may optionally break a meal down into individual food items. A private progress area lets users record one body-weight measurement per week and add up to four progress photos for that week.

The experience should be modern, blue-gradient-led, responsive, and lightly gamified. Game elements reward consistent logging without judging what the user eats or whether they meet a particular body or nutrition outcome.

## 2. Goals and success criteria

### Goals

- Make today's calorie consumption and remaining calories understandable at a glance.
- Track daily calories, protein, carbohydrates, and fat against user-defined targets.
- Make logging a whole meal quick; offer optional per-food itemization.
- Let users vary targets by date, including carb-cycling schedules, while carrying forward the previous day's targets by default.
- Preserve historical logs and the target values that applied to each date.
- Provide private weekly weight and photo progress tracking.
- Make the core experience comfortable on a phone, in English and Arabic.

### Product measures

- Time to log a quick meal from Home.
- Percentage of active users who log meals on multiple days per week.
- Successful meal saves and edits.
- Target and daily-total calculation correctness.
- Successful private photo uploads and access-control checks.

Do not send meal names, food notes, macro values, body weight, or photo data to product analytics.

## 3. Scope

### In scope

- Accounts, profiles, and private user data.
- Email/password registration and login, password recovery, and Google sign-in.
- Manually entered daily calorie, protein, carbohydrates, and fat targets.
- Daily nutrition records with date-based history.
- Meal logging in quick-total or optional itemized mode.
- Home dashboard, meal creation/editing, history, and target editing.
- One weight measurement per user per week.
- Up to four private body-progress photos per user per week.
- Light logging-based XP, streaks, and achievement milestones.
- English and Arabic localization, including right-to-left Arabic layouts.
- Responsive ReactJS web client backed by a Django API.

### Explicitly out of scope

- Workout plans, exercise catalogs, workout logging, or training features.
- Nutrient counters beyond calories, protein, carbohydrates, and fat.
- Shared food databases, barcode scanning, recipe databases, AI food recognition, or automatic nutrition estimates.
- Automatic calorie/macro target recommendations.
- Social feeds, public profiles, photo sharing, coaches, leaderboards, subscriptions, or payments.
- React Native mobile applications in this release.
- Offline synchronization in the initial release.
- Inferring body fat, muscle gain, or health status from photos or weight.

## 4. Users and privacy

The initial audience is an individual user recording their own nutrition and private progress. Each account owns its profile, daily logs, meals, itemized foods, weights, progress photos, and game progress.

All user-owned records must be protected by server-side ownership checks. A user must never read, edit, delete, or download another user's data by changing an object ID or media URL. Progress-photo originals and thumbnails must not be publicly accessible. Serve private images only after authenticated authorization; do not rely on obscure filenames as access control.

## 5. Platforms, stack, and architecture

- **Frontend:** ReactJS responsive web client. Use reusable components and API client/services separated from presentation.
- **Backend:** Django with Django REST Framework as the API layer.
- **Database:** PostgreSQL is the recommended default. Use Django migrations for all schema changes.
- **Authentication:** email/password plus Google sign-in. Use a maintained authentication integration; do not build OAuth protocol handling from scratch.
- **API:** JSON REST endpoints under `/api/v1/` with authenticated access for private user data.
- **Media:** private storage adapter. Local development may use private local media; production storage must deny public reads and be served through authorized application views or short-lived access.

Implement the web product first. Keep nutrition calculations and validation in reusable backend domain/service code, and make the client display server-confirmed values after mutations.

## 6. Core product rules

### 6.1 Local date and weekly boundaries

- Store the user's IANA timezone in their profile; use it to determine today's date and streak dates.
- Store a date-only value for a nutrition day and progress week. Do not derive historical local dates again from timestamps after a timezone change.
- A progress week runs Monday through Sunday in the user's configured timezone.
- Store the week-start date on each weekly weight/photo record. Changing the profile timezone must not silently regroup existing records.

### 6.2 Daily nutrition targets

- Each date has calorie, protein-gram, and fat-gram targets.
- Users may set different values for any date.
- When a date is first created, prefill targets from the closest earlier saved date; if no earlier date exists, use the targets entered during onboarding or target setup.
- Target values support decimal precision. Reject negative values; zero may be explicitly saved.
- A target edit applies only to the selected date. It must not silently change earlier or later days.
- A target can be saved for a date even if no meal has been logged yet.
- Do not calculate macros from calories or infer one target from another.

### 6.3 Meals and nutrition calculation

Each meal belongs to exactly one user's nutrition day and has a name and display order.

**Quick-total mode:**

- The user may enter a text list/description of the foods eaten for memory.
- The user enters the combined calories, protein, carbohydrates, and fat for the entire meal.
- These values are included once in that day's totals.

**Itemized mode:**

- The user enters one or more food items, each with a name and its calories, protein, carbohydrates, and fat.
- The meal totals are calculated by summing its items.
- Do not also count manually entered meal-level totals in itemized mode.

Users can edit, reorder, and delete their meals and itemized foods. Every save, edit, or delete recalculates the affected day's consumed totals. Values support decimals for calories and macros. No food-weight calculation is required.

New meal names default to `Meal 1`, `Meal 2`, `Meal 3`, and continue sequentially within that day. Users can rename them. If a meal is deleted, retain the ordering of remaining meals and assign the next new meal the next available sequential label.

### 6.4 Daily totals and over-target behavior

For the selected day:

`consumed = sum of meal totals for that day`\
`remaining = target - consumed`

- Show consumed/target and remaining for calories, protein, carbohydrates, and fat.
- Calories receive the strongest visual emphasis on Home.
- When remaining is negative, display the amount over target and preserve the actual consumed total.
- Never clamp values, block additional logging, or use shaming language.
- An empty day means “No meals logged,” not proof that the user consumed zero.
- Calculate totals from persisted meal/item data on the server; the client may optimistically preview changes but must reconcile after the API response.

### 6.5 Weekly weight and photos

- Each user may save at most one weight measurement per week. Editing that week's measurement replaces/corrects it; it does not create a second measurement.
- Weight may be recorded whether or not any photos are uploaded.
- A week may be skipped entirely.
- A user may upload zero to four active progress photos per week. Photos are always private to their owner.
- Photos in the same week share the week's single weight record; they do not create separate weigh-ins.
- When photos exist for a week, require a weight measurement for that week before finalizing the first photo. If the weight is later corrected, all photos continue to refer to that week's measurement.
- Allow photo captions/labels and capture dates. Do not analyze image contents.
- Enforce the four-photo limit transactionally on the server so concurrent requests cannot exceed it.
- Proposed upload default: maximum 10 MB per image; accept JPEG, PNG, and WebP. Make the size limit configurable.

### 6.6 Gamification

- Gamification is a supportive presentation layer; it must never change nutrition totals or targets.
- Award a small daily XP reward once per local date after the user has saved at least one meal. Proposed default: 10 XP per qualifying date.
- A logging streak counts consecutive local dates with at least one saved meal. A missed date breaks the active streak but never removes XP or previously earned achievements.
- Award achievements for neutral logging milestones (for example, first logged day, seven logged days, and thirty logged days).
- Never award points for eating fewer calories, going under a target, uploading body photos, recording a particular weight, or achieving a body-size outcome.
- Keep XP values and milestone thresholds in backend configuration/constants so they can be tuned without schema changes.

## 7. Functional requirements and acceptance criteria

### FR-01 — Accounts and profile

Users can register/login with email and password, reset their password, and sign in with Google. The profile stores display name, timezone, interface language (`en` or `ar`), and preferred weight unit (`kg` or `lb`). Default weight display is kilograms. Store weight in a normalized unit (kilograms) and convert for display/input.

**Acceptance:** authenticated users can access only their own records; locale and unit preferences persist; changing display units does not change stored weight.

### FR-02 — Home dashboard

Home opens to the current local date and prioritizes a prominent calorie progress visualization. It shows consumed calories, target, remaining/over amount, then smaller protein, carbohydrate, and fat counters. It shows meal cards and a clear Add Meal action. Users can select another date and access/edit that date's targets.

**Acceptance:** Home reflects the selected date, displays the four supported nutrition measures, updates after every meal mutation, and remains usable on narrow phone screens without horizontal scrolling.

### FR-03 — Meal management

Users can create, view, edit, reorder, and delete meals in quick-total or itemized mode. The UI explains that quick-total nutrition is for the entire meal. Itemized mode computes totals from foods and cannot double-count meal-level totals. Food names/description are for the user's memory and are not searched against a database.

**Acceptance:** quick meal totals equal exactly the entered combined values; itemized totals equal the sum of saved items; editing/deleting an item updates the meal and day totals; negative values are rejected.

### FR-04 — Target history and day history

Users can browse a calendar/list of previous days, inspect meals and totals, and edit historical meals or targets. When a date without a saved nutrition-day row is opened, prefill targets from the closest earlier saved day (or initial defaults), and create/save the row on first mutation.

**Acceptance:** editing a historical target affects only that date; repeated date access does not duplicate days; day selection uses local-date semantics.

### FR-05 — Weight and photo progress

Users can navigate by week, add/edit that week's single weight, and optionally add up to four private photos. The app provides a weight-over-time chart, weekly photo gallery, and side-by-side comparison of two selected weeks. Display dates and units. Show empty states and upload errors without losing the user's form state.

**Acceptance:** a fifth photo is rejected while preserving the current gallery; a weight-only week is supported; a photo cannot be finalized without the week's weight; one account cannot access another account's photo metadata or image bytes.

### FR-06 — Localization and responsive UX

Provide English and Arabic. Arabic screens use correct RTL direction, mirrored layout where appropriate, localized labels/date formats, and readable numeric values. Design phone-first with responsive tablet/desktop layouts. Provide keyboard navigation, visible focus states, semantic labels, adequate contrast, and reduced-motion support.

**Acceptance:** primary journeys (sign in, set targets, add/edit meal, browse history, record weight, upload/view photos) work in both languages and at mobile widths.

### FR-07 — Gamification and motion

Show logging XP, streak state, and milestone achievements without moving focus away from calorie tracking. Use subtle progress animation and brief success feedback. Avoid blocking dialogs, flashing effects, or streak guilt.

**Acceptance:** duplicate API retries cannot grant duplicate daily XP; adding a meal to a previously rewarded date does not grant XP again; achievements are awarded once; reduced-motion mode removes nonessential animation.

## 8. UX and screen requirements

1. **Authentication:** sign in, create account, password reset, Google sign-in.
2. **Onboarding:** language, timezone, weight unit, initial calorie/protein/carbohydrate/fat targets.
3. **Home:** calorie hero/progress, protein, carbohydrate, and fat support counters, selected date, meal list, Add Meal, subtle XP/streak summary.
4. **Meal editor:** quick-total and itemized modes, food description/item list, macro inputs, save/cancel, validation.
5. **History:** date/week navigation, daily totals, meals, target editing.
6. **Progress:** weekly weight, private photos, up to four photos per week, weight chart, week comparison.
7. **Profile/settings:** account, language, timezone, weight units, privacy/account actions.

Use blue gradients as the primary visual identity with a restrained complementary accent. The design should feel playful and polished rather than childish. Calories must be visually dominant on Home; protein, carbohydrates, and fat are secondary. Make the Add Meal action reachable by thumb on mobile. Use non-color cues and labels for all charts and statuses.

## 9. API outline

Use `/api/v1/` JSON endpoints. Exact URL naming can follow the Django project's conventions, while preserving these resources and behaviors:

- `GET/PATCH /profile/` — profile settings.
- `GET/PUT /nutrition-days/{date}/` — retrieve/create-on-write day targets and totals for the authenticated user's local date.
- `GET/POST /nutrition-days/{date}/meals/` — list/create meals for a date.
- `GET/PATCH/DELETE /meals/{id}/` — read/update/delete an owned meal.
- `POST /meals/{id}/items/` and item `PATCH/DELETE` — manage itemized foods.
- `GET /history/?from=YYYY-MM-DD&to=YYYY-MM-DD` — paginated historical daily summaries.
- `GET/PUT /progress/weeks/{week_start}/weight/` — retrieve or upsert the one weight for that week.
- `GET/POST /progress/weeks/{week_start}/photos/` — list/upload photos with server-enforced limit.
- `DELETE /progress/photos/{id}/` — delete an owned photo.
- `GET /gamification/` — XP, streak, and earned achievements.

Use serializer validation and service-layer transactions for meal-mode rules, daily totals, XP idempotency, weekly weight uniqueness, and photo-count enforcement. Return structured field errors. Paginate history and photo collections where needed.

## 10. Non-functional requirements

- **Security:** authentication and ownership authorization on every private endpoint; CSRF/session or token strategy documented; secure password handling; restricted CORS; image content/type/size validation; private media access; HTTPS in deployment.
- **Data integrity:** database constraints for unique user/date, unique user/week weight, and maximum four active photos (enforced in a transaction/service plus tests). Use transactions for itemized meal edits and photo acceptance.
- **Accessibility:** keyboard access, semantic controls, readable contrast, assistive labels, chart text alternatives, and reduced motion.
- **Performance:** paginated history, lazy-load thumbnails, compress/resize photo display derivatives, and avoid loading all historical data on Home.
- **Reliability:** repeat requests must not duplicate meals or rewards when an idempotency key is supplied; failed photo uploads remain recoverable.
- **Privacy lifecycle:** users can delete their own photos and account. Account deletion removes personal records and media through tracked deletion; never expose photos via public static paths.
- **Observability:** log operational failures and request IDs, not food notes, macro values, weight values, tokens, or photo URLs/content.

## 11. Implementation sequence for the coding agent

1. Inspect the repository and document its current framework, environment, and conventions before changing files.
2. Establish Django models/migrations, API validation, authentication, and owner-only permissions.
3. Implement daily targets, meal quick/itemized modes, and server-calculated totals; verify core business rules.
4. Build the responsive React Home and meal editor against the API.
5. Add history and date-specific targets.
6. Add weekly weight, private photo upload/gallery/comparison, and secure media delivery.
7. Add English/Arabic localization and RTL layouts across all screens.
8. Add XP/streak/achievements and reduced-motion behavior.
9. Complete responsive, authorization, calculation, and upload acceptance checks; provide setup instructions and environment variable examples.

Do not implement out-of-scope features. Keep product rules explicit in backend tests and avoid duplicating business rules only in the frontend.

## 12. Definition of done

- A user can sign in, configure targets, and see a calorie-first Home dashboard.
- A user can quick-log a whole meal or itemize it without double-counting.
- Calories, protein, carbohydrates, and fat totals and remaining/over values are correct after create/edit/delete.
- Per-date targets carry forward by default and historical values remain unchanged unless explicitly edited.
- Weight-only weeks work; photos are optional, private, limited to four per week, and associated with a single weekly weight.
- English and Arabic flows work responsively, including RTL.
- Gamification rewards logging actions only, is idempotent, and does not punish missed days.
- Access-control and business-rule checks pass; setup and deployment configuration are documented.

## 13. Opt-in weekly email check-ins

Users can opt in from Profile, choose a weekday/time in an IANA timezone, and include an optional photo reminder. Confirm mailbox ownership before sending weekly reminders. Confirmation and unsubscribe links require an explicit action, work without sign-in, and never change preferences merely on GET.

Acceptance criteria: reminders default off; scheduling respects local weeks and daylight saving; completed weekly check-ins suppress reminders; English and Arabic messages contain no private photos or health values; disabling, deactivation, email changes, and account deletion stop delivery. Concurrent workers cannot duplicate a weekly accepted/uncertain attempt. Provider failures have bounded safe retries, a daily cap, aggregate diagnostics, and a documented free-tier setup. The operator must enable delivery after configuration; timing is best effort.
