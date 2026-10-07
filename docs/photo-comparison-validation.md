# Independent photo comparison

Compare now has two independent photo selectors, each showing thumbnails grouped by week. Users can choose any photo on either side, including two photos from the same week. Opening Compare loads remaining history pages so every saved week is available. Pagination failures show an error and retry control; thumbnails remain lazy-loaded.

The selected original images appear side by side with the full image fitted without cropping. The comparison gallery spans the available desktop content width. Mobile and RTL layouts retain two columns. Existing full-screen viewing and photo deletion remain available.

Photo labels and full-screen titles include the photo name (or numbered fallback), saved week date, and that week's weight. Weight uses the profile's preferred unit and localized formatting. Gallery captions also show the photo name and weekly weight. A missing weight is shown as no entry, never zero.

Checks:

- Frontend production build passed; existing bundle-size advisory remains.
- Vitest: 7 tests passed.
- Chromium UI checks with mocked APIs passed: arbitrary cross-week pair; different photos in the same week; automatic loading of older history pages; failure/retry; photo weight labels in kg and lb; full-screen titles; original previews with object-contain; mobile two-column layout/no overflow at 390px; English and Arabic RTL; no browser page errors.
- Desktop and mobile screenshots inspected.
- `git diff --check`: passed.

GitHub authentication was restored after validation. The accumulated feature changes are submitted for review against `dev`.
