# Loading, dark mode, and saved-food editing

The startup screen appears from the initial HTML and remains visible during authentication loading. It uses a floating blue-gradient mark, orbit animation, soft background glow, and an indeterminate loading bar. System reduced-motion disables its animation. No artificial loading delay is added.

Dark mode follows the system preference on first visit. Users can toggle it from the app toolbar or sign-in page; the choice persists in localStorage on this device. An early startup script applies the theme before rendering. Semantic colors adapt cards, text, fields, navigation, chart tooltips, sheets, and toasts. Theme selection does not modify server profile data.

Saved-food editing identifies the original food name in an editing banner and heading, highlights its list card, scrolls to the editor, and focuses the name field. Save is disabled while pending, failures keep form data, and Cancel returns to creation. Editing badges, guidance, and theme controls include Arabic labels.

Validation results:

- Frontend production build passed; existing large-bundle advisory remains.
- Vitest: 7 tests passed.
- Chromium browser checks with mocked API responses passed: startup loading animation; pre-JavaScript loading fallback; reduced-motion behavior; dark card colors; persistent theme after reload; editing heading/card/focus/cancel; no horizontal overflow at 390px; system-dark sign-in; Arabic RTL theme toggle; no application page errors.
- Desktop and mobile screenshots visually inspected.
- `git diff --check` passed.

Limitations: browser checks isolate UI with mocked responses and do not revalidate backend persistence or authentication. GitHub authentication was restored after validation. The accumulated feature changes are submitted for review against `dev`.
