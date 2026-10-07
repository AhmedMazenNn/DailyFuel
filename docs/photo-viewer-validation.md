# Full-screen progress photos and replacement uploads

Gallery and Compare photos open a full-viewport native modal dialog using the authenticated original-image URL. Thumbnails load lazily in the gallery. The viewer fits the whole image, provides loading/error feedback, supports Escape and a Close button, traps focus through native dialog behavior, and locks background scrolling.

Users can delete a photo from its thumbnail or viewer after confirmation. A failed delete keeps the viewer open with an error and retry controls. A confirmed server deletion immediately removes the photo from local weekly state and frees an upload slot; a follow-up refresh failure cannot misreport a completed deletion. The weekly weight is retained.

Progress now loads saved weeks and the current week's record when opened, and offers pagination for older weeks. Upload controls show the four-photo limit, disable while uploading/full, and reset the file input so a replacement can reuse the same filename. New labels include English and Arabic.

Checks:

- Local PostgreSQL `manage.py test progress --noinput`: 4 tests passed, including private full-image access, ownership-protected deletion, four-photo limit, delete-and-replace, and retained weight.
- Vitest: 7 tests passed.
- Production frontend build passed; existing bundle-size advisory remains.
- Chromium browser checks with mocked APIs passed: loading persisted photos, full-viewport dialog and original image URL, Escape/Close, delete cancellation, failure/retry, immediate available slot, replacement upload, Compare viewer, no overflow at 390px, and no browser page errors.
- `git diff --check`: passed.

GitHub authentication remains invalid; PR creation against dev is blocked. Nothing merged into dev or main.
