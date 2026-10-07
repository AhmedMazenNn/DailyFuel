# Saved food portions

Users can add saved foods in the itemized meal editor when creating or editing a meal. Choose a food and enter grams consumed; calories, protein, and fat are calculated from the saved serving. Saved rows show nutrition as read-only and permit portion edits. Manual food rows remain supported.

The server uses Decimal arithmetic and rounds contributions to two decimal places. New entries require an active food owned by the authenticated user. Existing items preserve their logged nutrition snapshot when the saved definition changes or is removed; correcting their amount scales their own historical snapshot. Deletion archives the reusable definition and leaves meal history intact.

Saved foods provides Edit, Save changes, Cancel editing, and Delete controls. Delete asks for confirmation and mutation errors remain visible. Zero nutrition values are accepted, while serving and consumed amounts must be positive.

Validation:

- `manage.py test nutrition --noinput`, using local PostgreSQL: 12 tests passed.
- `npm run build --prefix frontend`: passed (existing bundle-size advisory).
- `npm test --prefix frontend`: 7 tests passed.
- `git diff --check`: passed.

Gaps: interactive browser journeys were not automated in this change. GitHub authentication was restored after validation. The accumulated feature changes are submitted for review against `dev`.
