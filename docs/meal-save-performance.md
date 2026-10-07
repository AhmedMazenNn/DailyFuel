# Meal save performance investigation

Measured on 2026-10-07. The previous save flow waited for a meal mutation, a day fetch, and a gamification fetch in sequence. Both the mutation and gamification fetch reconciled every historically logged day with individual reward lookups. Itemized saves also wrote each food separately.

## Database query measurements

Authenticated API tests used a separate local PostgreSQL test database and Django's `CaptureQueriesContext`. Existing rewards and achievements were warmed before measurement. These are query counts, not production latency measurements; session middleware and network connection establishment are not included.

| Meal POST scenario | Before | After |
| --- | ---: | ---: |
| Quick meal, 1 previously rewarded day | 21 | 15 |
| Quick meal, 40 previously rewarded days | 64 | 15 |
| Itemized meal, 1 food and 40 rewarded days | 66 | 16 |
| Itemized meal, 40 foods and 40 rewarded days | 105 | 16 |

The new response includes authoritative day and gamification snapshots, eliminating the two follow-up requests after a successful create or edit. Reward lookups are batched; only missing rewards and achievements are inserted. Item inserts and updates are batched, and unchanged item/reward records are not rewritten. The existing transaction and user lock still protect ownership, reward idempotency, and concurrent saves.

## Connection latency

A read-only probe from the development machine to the configured Neon `us-east-2` endpoint took 1,046 ms to establish its initial connection. Five subsequent `SELECT 1` calls took 139, 138, 138, 137, and 140 ms. The network cost therefore compounds with sequential database queries. Reducing query count addresses that cost, but does not remove the underlying remote connection latency. No application records were changed for this probe.

## Regression coverage

Backend tests cover constant query counts across the measured history/item sizes, exact meal/day totals, current snapshots on idempotent retries, reward behavior on future dates and deletion, concurrency, and ownership checks. Frontend coordination applies mutation snapshots directly and prevents older day/reward/history reads from replacing them. Concurrent nutrition writes are serialized in the client, and deletion refreshes day and rewards in parallel.

No browser end-to-end timing or production save benchmark was performed. Query counts do not imply a fixed wall-clock saving; network conditions, cold starts, locks, and database load still affect response time.
