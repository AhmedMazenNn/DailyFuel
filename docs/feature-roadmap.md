# DailyFuel implementation roadmap

Source requirements: [PRD](prd.md) and [ERD](erd.md), version 1.0. This is a delivery plan, not a claim that the features are implemented.

## Product boundaries

DailyFuel is a responsive React nutrition application backed by Django REST Framework and PostgreSQL. It tracks calories, protein, and fat, with date-specific targets, quick or itemized meals, private weekly weight/photos, English/Arabic, and logging-based rewards. Workouts, carbohydrate counters, food databases, nutrition recommendations, payments, social features, and offline sync are outside this release.

The existing frontend design is preserved locally in the gitignored `design-reference/frontend` directory. Import its shared components and screens in the feature that needs them; do not publish the complete design application in the setup commit. Mock data and client calculations must be replaced by server-confirmed behavior as each feature ships.

## Branch and review rules

- `main` receives the initial repository setup only until the project is complete. The eventual release is a reviewed `dev` → `main` PR after the PRD definition of done passes.
- `dev` is the integration and testing branch. Feature PRs target `dev`, never `main`.
- Start each `feature/<name>` from the latest `dev`; keep each PR limited to one deliverable below. Split a deliverable into smaller PRs if its review becomes difficult.
- Include the requirement, behavior, migration impact, verification evidence, and remaining limitations in each PR. Merge only after its acceptance checks pass.
- Give simultaneous terminals/agents separate Git worktrees and branches. Assign explicit file ownership; one coordinator handles shared integration, PRs, and merges. Backend and frontend work may run together once their API contract is agreed.
- Do not treat a mock screen, successful build, or merged branch as proof that a backend requirement is finished.

## Delivery sequence

All acceptance checks below are required when their feature is implemented. Setup work does not imply running checks against functionality that does not exist yet.

| Order / branch | Scope | Depends on | Acceptance checks |
|---|---|---|---|
| 0 — setup on `main` | README, repository layout, requirements/design inventory, ignore rules, contributor/agent workflow | None | Setup contains no secrets, generated dependencies, or complete design dump; branch and local setup instructions match the repository. Create `dev` from this baseline. |
| 0a — `feature/development-workflow` | This roadmap and detailed development/agent collaboration workflow | 0 | Reviewed PR targets `dev`; worktree ownership and feature delivery sequence are explicit. |
| 1 — `feature/backend-foundation` | Django/DRF project, PostgreSQL configuration, `/api/v1/`, structured errors, configuration and basic CI | 0 | Clean environment can install and migrate; secrets come from environment; API errors are predictable. Establish auth user strategy before the first auth migration. |
| 2 — `feature/accounts-profile` | Email/password authentication and recovery, owner permissions, profile timezone/locale/weight units, initial-target persistence | 1 | Separate accounts cannot access each other's records; recovery works; profile preferences persist; invalid timezone/locale/unit rejected; session/CSRF or token policy documented. |
| 3 — `feature/google-sign-in` | Maintained Google authentication integration and account-linking behavior | 2 | Success, denied consent, invalid callbacks, and duplicate-email/linking cases handled; deployment callback configuration documented. |
| 4 — `feature/frontend-shell` | Selective design import: theme, reusable primitives, responsive navigation, API client, English/Arabic infrastructure, auth/onboarding screens | 2; Google action follows 3 | App renders at phone/desktop sizes; auth errors and loading states work; initial targets and preferences save; keyboard focus and RTL structure established. |
| 5 — `feature/daily-targets-api` | Nutrition-day migrations, read without creation, create-on-write, decimal target snapshots and carry-forward service | 2 | Unique user/date under concurrency; closest earlier saved targets or initial defaults used; explicit zero accepted; negatives rejected; editing one date leaves all others unchanged; GET has no write side effects. |
| 6 — `feature/quick-meals-api` | Quick meals, CRUD/reordering, persisted-data totals, monotonic default naming, request idempotency | 5 | Decimals preserved; retries with the same key cannot duplicate meals; create/edit/delete recompute totals; order/name behavior survives deletion; cross-account IDs fail. |
| 7 — `feature/itemized-meals-api` | Item CRUD/reordering, atomic mode transitions and summed meal/day totals | 6 | Itemized meals have at least one item at completion; quick fields cannot double-count; failed transitions roll back; item changes update totals; concurrent edits preserve integrity. |
| 8 — `feature/home-quick-meals` | Design Home, calorie hero, protein/fat counters, quick meal editor and selected-day target sheet | 4, 6 | Only three nutrition measures; server response reconciles mutations; negative remaining shown as over target; empty days say no meals logged; mobile and keyboard flows work. |
| 9 — `feature/itemized-meal-editor` | Itemized editor, mode switching, item and meal reordering | 7, 8 | Quick and itemized paths match API totals; validation retains draft input; switching modes is explicit; create/edit/delete/reorder work in both languages. |
| 10 — `feature/nutrition-history` | Paginated summaries, calendar/list, historical meal and target editing | 5, 8, 9 | Date selection respects local dates; historical target isolation holds; unsaved dates preview without duplicate rows; large history is paginated. |
| 11 — `feature/weekly-weight` | Weekly-weight migrations/API, progress navigation, kg/lb input/display and weight chart | 2, 4 | One weight per Monday-start week under retries/concurrency; weight-only weeks work; measured date validated; timezone/unit changes do not regroup records or change stored kilograms; chart has text alternatives. |
| 12 — `feature/private-progress-photos` | Authorized image storage/delivery, upload/delete, derivatives, four-photo transaction and recoverable cleanup | 11 | First photo requires that week's weight; concurrent uploads cannot exceed four; unauthorized metadata/original/thumbnail access fails; type/content/size validated; failed uploads recover; deleting releases a slot and removes storage objects. |
| 13 — `feature/progress-gallery` | Selective progress design import: gallery, captions, capture dates, two-week comparison | 12 | Weight and dates accompany photos; fifth-photo error preserves form/gallery; thumbnails load lazily; comparison and empty states work on phones and in RTL. |
| 14 — `feature/logging-rewards` | Reward/achievement migrations and service, XP/streak API, subtle frontend display and motion | 6, 8; historical behavior after 10 | Reward and achievement retries/concurrency are idempotent; rewards depend only on logging; historical edits/deletions follow documented policy; missed days never revoke XP/achievements; reduced motion disables nonessential animation. |
| 15 — `feature/account-deletion` | Account deletion UX/API and tracked private-media removal | 2, 12 | Deleted accounts lose access; owned records removed; storage deletion failures are tracked/retried; orphaned files cannot be served; operational logs exclude sensitive data. |
| 16 — `feature/accessibility-localization` | Complete translations and audit every primary flow, responsive layouts, charts, focus, contrast and reduced motion | 3–15 | Sign-in, targets, meal editing, history, weight and photos work in English/Arabic at narrow widths; no horizontal scrolling; keyboard/screen-reader labels and localized dates are usable. |
| 17 — `feature/release-readiness` | Deployment/HTTPS/private storage guidance, scoped acceptance suite, query/performance review, operational logging | 1–16 | PRD definition of done satisfied; ownership, calculation, timezone, retry and upload concurrency cases pass on PostgreSQL; production configuration and recovery steps documented. |

Features 3, 4, and 5 can proceed independently after accounts/profile. Weekly weight can proceed alongside nutrition after its dependencies are merged. Resolve shared model/API contracts before delegating overlapping migrations. Integrate dependent branches against `dev` as their prerequisites land.

## Schema gaps and implementation decisions

Record the chosen policy in the owning feature PR and update the schema documentation when it changes. The recommendations below are planning proposals, not implemented behavior.

| Gap or ambiguity | Proposed decision / required resolution | Owning feature |
|---|---|---|
| Initial target defaults are required by PRD but absent from ERD | Add explicit decimal initial targets and onboarding completion state to a profile/settings model. Do not invent automatic targets. Define behavior before onboarding is complete. | Accounts/profile |
| Auth identity, email uniqueness and Google linking are unspecified | Choose a maintained integration, case-insensitive email identity policy, and explicit verified-account linking strategy before initial migrations. | Accounts/profile + Google |
| ERD permits creating a day when opened for editing; PRD says first mutation | Follow PRD create-on-write: GET returns a target preview; first mutation persists the snapshot transactionally. | Daily targets API |
| Meal request idempotency has no schema support | Persist owner, operation, key, payload fingerprint and outcome under a uniqueness constraint; define retention and rejection of key reuse with another payload. Include retries after response loss. | Quick meals API |
| Sequential meal labels cannot be reconstructed reliably after deletion/rename | Keep a per-day next-meal sequence, independent of display position, and allocate it under the day lock. Confirm whether “next available” permits reuse; prefer monotonic labels to avoid surprising renumbering. | Quick meals API |
| Itemized completion/drafts and deleting the last item are unspecified | Save a complete itemized meal and its initial items atomically; keep unsaved drafts on the client. Reject removing the last persisted item unless deleting the meal or switching modes atomically. Document switch data retention. | Itemized meals API |
| Ordering constraints and numeric bounds need concrete choices | Document max precision, rounding and input overflow errors; select safe ordering fields and an atomic reorder strategy that avoids unique-position collisions. | Nutrition APIs |
| Photos have no FK to weekly weight despite deletion protection requirement | Add a real weekly-weight relation or a documented equivalent that enforces same owner/week and blocks weight deletion. Lock the existing weight row during count-and-insert; apply the same protocol to deletion/finalization. | Private progress photos |
| “Active” photos, pending uploads, derivatives and tracked deletion are absent | Define synchronous versus staged uploads, active status semantics, private derivative references, and durable deletion jobs. Storage writes are not rolled back by database transactions. | Private progress photos + account deletion |
| Capture date default may fall outside a historical selected week | Explicitly decide allowed capture-date range and default for historical uploads; do not silently move a photo to another week. | Private progress photos |
| XP survives missed days but day deletion cascades its reward ledger | Preserve earned XP/achievements after meal deletion; define nutrition-day deletion policy so reward history cannot be removed then rewarded again. No day-delete endpoint is required for this release. | Logging rewards |
| Streak caches can become stale and backdated/future logs are unspecified | Define today/yesterday active-streak behavior, future-date eligibility, and recomputation after backdated edits/deletions. Distinguish currently logged dates from permanently earned reward history. | Logging rewards |
| Thresholds are both backend configuration (PRD) and catalog fields (ERD) | Choose one authoritative definition and seed/update the catalog from it; retain already earned achievements when thresholds change. | Logging rewards |
| Duplicate owner fields can disagree across rewards/photos and their parent rows | Derive ownership through the parent where possible; otherwise enforce consistency in a single transactional service and never accept arbitrary client owner IDs. | Relevant API features |

## Integration completion

The coordinator keeps this roadmap current as PRs merge, recording actual PR links and verification results rather than marking planned work complete. The final release PR should enumerate the completed PRD acceptance criteria and any explicitly accepted limitations. Until that release, all product implementation remains on `dev` and its feature branches.
