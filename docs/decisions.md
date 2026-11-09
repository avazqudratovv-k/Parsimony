# Decisions

## Day 1
- Postgres from day one (dev and prod); SQLite only for fast tests.
- Backend routes live under `/api` so Nginx can serve the frontend at `/` and proxy `/api`.
- Config via environment variables (pydantic-settings); `.env` is git-ignored, `.env.example` is committed.

## Day 2
- SQLAlchemy 2 typed models (`Mapped[...]`); UUID primary keys, except `usage_counters` (integer id).
- Category, payment method and source are plain strings in the database. The allowed values live in
  `app/models/enums.py` and are enforced by Pydantic at the API edge. This avoids native Postgres
  enums, which are awkward to change in migrations.
- `usage_counters.scope` is a string (`global` or `u:<user_id>`) because Postgres treats NULLs as
  distinct in unique constraints.
- `entries.ai_output` keeps the raw model output next to the user-corrected columns, so corrections
  can become training pairs later.
- The engine is created lazily (`get_engine()`), so importing the app never needs a database.
- Migrations are generated with `alembic revision --autogenerate` against the real Postgres.

## Day 3
- Auth is a signed httpOnly cookie (itsdangerous) holding only the user id, valid for 7 days. No sessions
  table; logout clears the cookie. Passwords use argon2.
- Cookie is `SameSite=Lax` and `Secure` in production. State-changing routes take JSON, which also
  limits cross-site form posts.
- Login failures return one generic 401, and an unknown email still costs one password check, so timing
  doesn't reveal which emails exist. Signup does say "already registered" (a UX trade-off).
- Rate limits (in memory, per IP): 5 signups per hour, 10 logins per minute. Behind Nginx every request
  looks like the same IP, so Day 10 must read `X-Forwarded-For`.
- In production the app refuses to start with the default `SECRET_KEY`.
- Tests run on in-memory SQLite with foreign keys on; Alembic migrations are checked against Postgres.

## Day 4
- Adapters only return the model's raw JSON text (`ai/base.py`). Validation, the single retry and the
  "not an expense" rule live in `services/parse_service.py`, so the fine-tuned model gets the same checks.
- The model is asked for `amount: 0` when the text isn't an expense; that is reported to the user and not
  retried. Bad JSON or a failed validation (wrong enum, future date, bad currency) is retried once.
- Messy-but-harmless values are normalized, not rejected (currency case, amount rounded to 2 decimals).
- The prompt carries today's date, the timezone and the default currency. User text goes in as data, not
  instructions, and the output is schema-constrained, so prompt injection can't do more than produce a
  wrong entry that fails validation.
- `ENTRY_JSON_SCHEMA` is built from the enums so prompt, schema and database can't drift apart. Gemini's
  structured output ignores length limits, so Pydantic enforces them.
- Default model `gemini-3.5-flash-lite` (set `GEMINI_TEXT_MODEL` to change it). Not yet exercised against
  the live API.
- `POST /api/entries/parse` previews only and needs login. Daily AI-call caps arrive on Day 5, before any
  public deploy.

## Day 5
- `POST /api/entries` takes text and saves an entry (AI). `POST /api/entries/manual` saves one by hand with
  no AI call, so a failed parse is never a dead end. `POST /api/entries/parse` still only previews.
- "Fix this" is `PATCH /api/entries/{id}`: only the fields sent change. A real change to an AI-made entry
  sets `user_corrected`; the model's original answer stays in `ai_output`, so (input, model answer,
  corrected row) can become a training example later. A patch that changes nothing is not a correction.
- Daily AI caps (UTC days): 30 per account, 10 per demo account, 300 for the whole app (settings, all
  overridable by environment variables). Preview and create share one counter. Failed calls count,
  because they can still cost money. Manual entries never count.
- The cap check is not locked, so simultaneous requests can overshoot by a few calls; the provider-side
  spend limit is the hard stop. The counter itself is an atomic upsert (Postgres and SQLite branches).
- Hitting a cap returns 429 with `{code, message, resets_at}` (`daily_limit_account` or
  `daily_limit_global`) so the UI can show the right message. `GET /api/usage` gives used/limit/reset.
- Money is returned as strings ("6.50") so the frontend never loses precision. Stats group by category in
  ONE currency (no conversion) and list every currency used that month for the currency tabs.
- Entries are only ever read or changed through the owner's id; another user's entry looks like a 404.

## Day 6
- "Try demo" is `POST /api/auth/demo`: a passwordless sandbox user (`demo-<random>@demo.parsimony.invalid`),
  15 made-up sample entries in USD/EUR/KRW with dates relative to today (one low-confidence row), a session
  cookie, and an `expires_at` 7 days out. Nobody can log into it with a password.
- Expired demos are rejected on every request (401 "This demo has expired") and deleted by
  `python -m app.cleanup`, which cascades to entries, attachments and the account's usage counters, and
  removes attachment files from the upload folder (a no-op until Day 11). Starting a new demo also cleans up
  first, so growth is bounded even if cron is missing. Deploy day: run the cleanup command from cron daily.
- Abuse limits: 10 demo starts per hour per IP, at most 200 live demo accounts (then 503 "demo is full"),
  10 AI entries per demo per day, and at most 100 entries per demo account (1000 per real account, 409
  `entry_limit`). A full account is refused before it spends an AI call.
- Sample entries carry `model_used = "sample"` and an `ai_output`, so "Fix this" behaves exactly like it does
  on real AI entries. The training-data export must skip all demo users and `model_used = "sample"` rows:
  visitors' corrections are not trustworthy training data.
- The `.invalid` demo domain also means nobody can sign up with an address that collides with a demo one.
- Signup and demo accept the browser's timezone, so "yesterday" means the user's yesterday.

## Day 7: frontend scaffold
- Vite dev server proxies `/api` to the backend, so the session cookie is same-origin: no CORS config in dev.
  In production Nginx does the same job.
- Router: TanStack Router with code-based routes (`/` sign-in, `/app`, 404). Guards run in `beforeLoad` using
  the cached `/auth/me` query; a 401 from `/auth/me` is treated as "signed out", not an error.
- Three languages (English, Korean, Uzbek-Latin) with a tiny own i18n layer instead of a library: one typed
  dictionary per language, English is the source of truth and the others must match its keys (typecheck and a
  test enforce it). Language is saved in localStorage; the default follows the browser. Dates and money
  formatting will use `Intl` with the active language on Day 8. Korean and Uzbek texts are first drafts and need
  a native speaker's review before launch.
- Error messages shown to users are translated on our side by HTTP status; the backend's English text is not shown.
- Theme: light, dark or follow-system, one cycle button, saved in localStorage. Colours are the design tokens.
- Logo: icon files from the design system (rounded green square with italic "p."), PNGs rendered from the SVG.
  The wordmark is live text in Newsreader Italic. The service worker and offline support come on Day 12.
- Fonts are self-hosted through `@fontsource` (Inter, Newsreader italic, Noto Sans KR) so no request goes to Google.

## My page (backend)
- A third screen, "My page" (`/me`), opened from the add bar: all-time overview, settings, log out, delete account.
- `GET /api/stats/overview`: entry count, the entry limit, the oldest entry date and all-time totals per currency
  (never converted). Month views stay on `/stats/monthly`; today's AI use stays on `/usage`.
- `PATCH /api/auth/me`: only default currency (3 letters, upper-cased) and timezone (IANA name). Email and
  password changes are deliberately left out of v1: they need re-authentication and a reset flow.
- `DELETE /api/auth/me`: removes the account, entries, usage counters and uploaded files, and clears the cookie.
  It shares `account_service.delete_users` with the demo cleanup, so there is one deletion path to get right.
  The "type delete to confirm" step is a frontend safeguard; SameSite=Lax cookies already stop cross-site requests.

## Dashboard and My page (frontend)
- Dashboard `/app`: add bar (type, press Add; mic and camera arrive on Days 12-13), the latest 100 entries, the
  AI counter ("3 of 30 AI entries used today") and a My page button in the bar. On phones the bar is docked to the
  bottom of the screen; on desktop it sits above the list. The chart and month controls come on Day 9.
- Typed text goes to `POST /api/entries` directly (no preview step): one tap, one entry. If the AI can't read it, the
  text stays in the box and an error explains why in the user's language.
- "Fix this": a full-screen sheet on phones, a dialog on desktop. It shows the original words ("You said"), sends
  only the changed fields (so an untouched entry is never marked "Edited") and needs two taps to delete.
- Entries below 0.75 confidence that nobody has corrected show a "Check this" chip.
- Money and dates use `Intl` with the active language (`$6.50`, `₩9,000`, `11월 9일`). Amounts stay strings in the
  data and are only turned into numbers for display.
- My page `/me`: overview, settings (default currency, time zone), log out and "Delete my account" (type `delete`
  to confirm, the same English word in every language so it is easy to type on any keyboard).
- The logo is the "Receipt" design from the design system (cream receipt with a torn edge, green P).

## My page: profile
- Profile block at the top of My page: a round avatar with the first letter of the display name (or of the email),
  the name, the email, and a "Demo" chip for demo accounts. No photo upload: it would need file storage, size
  and content checks and moderation for little gain.
- `users.display_name` (optional, 80 characters, migration `a1f3c9d2b7e4`), editable under Settings. Empty or
  null clears it and the page falls back to the part of the email before the @.
- Deliberately NOT added: phone number (nothing in the app uses it, and a public demo should hold as little
  personal data as possible) and a username (the email already identifies the account).
- Overview totals are never converted, so they can't be ranked by amount. Order: the default currency first, then
  the currency with the most entries, then alphabetical.
- The delete confirmation word is translated (delete / 삭제 / oʻchirish). Plain English "delete" is accepted in
  every language and any kind of apostrophe counts as the same one, so it works on any keyboard.
- Migrations are excluded from ruff: they are generated and should stay as Alembic wrote them.

## Day 9: chart, errors, browser tests
- Chart: one horizontal bar per category for ONE month in ONE currency (no conversion). Single accent colour, thin
  bars with rounded ends, the value written at the end of each bar, tooltip on hover. The same numbers are in a
  hidden `<table>` so screen readers (and the tests) get the data. Currency tabs appear only when the month uses
  more than one currency and change only the chart; moving to another month resets them.
- Month controls: previous/next, "next" is off on the current month. "This month" uses the user's saved time zone,
  not the browser's. The entry list shows the same month as the chart (`GET /entries?month=`), and adding an entry
  jumps back to the current month because a new entry is dated today.
- Expired session: a 401 from any request while the app thinks the user is signed in clears the cached user and
  returns to the landing page with one notice. A wrong password also returns 401 but nobody is signed in then, so
  it is left alone.
- Crash screen: a translated "Something went wrong / Reload" page for rendering errors (router default error component).
- Browser tests (Playwright, `frontend/e2e/`): Try demo + Fix this + log out, sign-up/reload/log out/log in, wrong
  password, month controls, language switch, not-found. They never add an entry, because that calls the AI model;
  adding is covered by unit tests with a fake API. The demo account starts with sample entries, which is what makes
  Fix this testable without the AI.
- `RATE_LIMIT_SCALE` (default 1) multiplies the sign-up/login/demo limits. Only the browser tests raise it, since
  they sign up many times from one address. Never set it in production.
- Unit tests pin "today" (only `Date`, via fake timers) to 2026-11-09 so month tests do not depend on the calendar.

## Design sync, stage 1 (Day 9.5)

- Applied the updated Claude Design: new tokens, custom line-icon set (`Icon.tsx`), two-column desktop layout (list + add bar left, sticky chart and "Needs a check" right), mobile chart card with top five + "Show all", day-grouped lists, source badges (Typed/Voice/Photo), "Check this" flag.
- Removed Recharts. The chart is hand-built bars (less code, smaller bundle, matches the design exactly).
- Copy now says "smart adds" instead of "AI entries".
- OPEN DECISION: the design says typing is free and only voice/photo count as smart adds (hidden fair-use cap on typed lines). Today every typed entry still calls Gemini and counts toward the 30/day cap. Kept counting all AI parses for now; only the wording changed.
- Deferred to stage 2: toasts with Undo, opening animation, mobile entry details screen, My page rework, parse-failure notice with "Enter manually", remaining custom icons. Voice and receipt screens belong to Days 11-13.

## Day 10 (deploy) and phone layout fixes
- Live at https://parsimony.duckdns.org (Docker Compose project `parsimony-prod`, only 127.0.0.1:4300 published, host Nginx site in /etc/nginx/conf.d/parsimony.conf, Let's Encrypt via certbot). Update: `git pull && docker compose -f docker-compose.prod.yml up -d --build`. Steps in docs/deploy.md.
- One backend worker on purpose (in-memory rate limits and daily caps). Host Nginx overwrites X-Forwarded-For, so limits count real visitor IPs.
- Phone fixes: hidden h1 was 100% wide and let the page drag sideways (now 1px, plus overflow-x: clip and no overscroll bounce); header sticky on phones; add bar keeps a fixed height (hint line space reserved).
- Day headers now show each day's total per currency ("Total $54.70", or "$24.50 + ₩9,000" on a mixed day).

## Typing is free, smart adds are photo and voice (Day 11 prep)
- Two separate daily pools in `usage_service`: **smart adds** (photo, voice; 30 per account, 10 per demo, 300 for everyone; the visible "N of 30 left" line and `/api/usage`) and **typed lines** (hidden fair-use cap: 300 per account, 50 per demo, 1000 for everyone). Typing never uses up a smart add and the other way round.
- Typed entries still call the model, so the typed global cap protects the Gemini free quota. Values are settings (`TEXT_DAILY_CAP_*`).
- New error codes `typed_limit_account` / `typed_limit_global` with their own translated messages.
- Receipt photos are deleted right after they are read; only the extracted entry is kept (privacy, less storage). Photos use the same Gemini key.

## Day 11: receipt photos (backend)
- `POST /api/entries/photo` (multipart: `file`, optional `timezone`): photo -> Gemini -> validated JSON -> saved entry with `source = "photo"`. Costs one smart add; uses the same validation and one retry as typed entries.
- The photo is held in memory only and never written to disk or the database, so there is nothing to delete later (the `attachments` table stays unused for photos). Only the entry the model read is kept.
- The real file type is detected from the first bytes (JPEG, PNG, WebP), not the label the browser sends. Limit 8 MB (`MAX_PHOTO_BYTES`). Checks run before a smart add is spent: file type, size, entry room, timezone.
- The receipt prompt asks for the final total paid (not a subtotal), the printed date and currency, and forbids card numbers, names, addresses and phone numbers in the note. Text written on the photo is treated as data, not instructions.
- `GEMINI_VISION_MODEL` is optional; empty means the text model is used (it accepts images). Not yet tested against the real Gemini API: the first real test is on the server once the frontend exists (Day 12).

## Day 12: receipt photos in the app

- The camera button uses a plain `<input type="file">`. On a phone that opens the camera or the photo library; on desktop, the file picker. No custom in-app camera (the design's 4a screen is skipped on purpose: no permission prompts, no extra code).
- The photo is shrunk to 1600px JPEG in the browser before upload (faster on mobile data). If the browser cannot decode it (HEIC), the original goes up and the server answers 415.
- The server saves the entry straight away, so "Check the receipt" shows what was saved. Edit opens "Fix this"; "Looks right" just closes. Cancel stops the upload but cannot undo a read that already started.
- One photo costs one smart add; the upload starts exactly once, even in React StrictMode.
- The mic button is not added until voice works, so there is no dead button.

## Day 12–13: voice

- The browser records with MediaRecorder, then decodes and re-encodes to 16 kHz mono WAV (~1 MB for 30 s). Phones record in different formats (webm / mp4), so one small universal format means the server and the model never have to guess. The server checks the first bytes (RIFF/WAVE), not the label.
- Two steps, as in the design: `POST /api/entries/transcribe` (clip -> words, one smart add, nothing saved), the user fixes the words, then the normal `POST /api/entries` with `source: "voice"`. Mishearing numbers is the main risk of voice input, so the user sees the words before anything is saved.
- Gemini does the transcription (same key, no extra server or model to run on the 2-CPU box). The clip is held in memory only, never stored, like receipt photos.
- Not built: the design's "We'll add" preview card. It needs a parse-without-save step; the saved entry already appears in the list with "Fix this".
- A confirmed voice entry also passes through the typed-entry pool (hidden fair-use cap), which is fine: it keeps one rule for all text that reaches the parser.

## Toasts and manual entry

- After a typed or voice entry a toast says what was added, with Undo. Undo deletes the exact entry that was just created, so it needs no extra backend. Deleting an entry has no undo yet (re-creating it would lose its source and original words).
- When the AI cannot read typed text (422), the error offers "Enter manually": the same form as "Fix this", pre-filled with what was typed, saved through the existing `/entries/manual` endpoint. No smart add is used, so it works even when the daily limit is used up.

## My page, opening animation, phone gestures

- **My page** is grouped into Overview, Settings, Account and a separate Danger zone, so the destructive action is never next to Save.
- **Opening animation** uses only opacity/transform/clip-path (no layout work), plays once per browser session (`sessionStorage`), is skipped by any tap or key, and shrinks to a 150 ms fade under reduced motion.
- **Phone gestures** (screens under 1024 px only): swipe left reveals a red Delete button (a short swipe snaps back, a very long one deletes), press and hold (~0.5 s) opens an Edit / Delete sheet. Vertical scrolling always wins, and the desktop "Fix this" button is unchanged. Delete is undoable: the entry disappears at once, the request is only sent after a 5-second Undo window (and is flushed if you leave the page), so Undo restores the original entry with its source and raw text intact.
- **Merchant logos: not built.** They would need an extra AI call per entry (cost), guess brand domains (often wrong) and send merchant names to a third-party logo service (privacy). Initials avatars are the cheap, offline alternative if wanted later.

## Toasts follow the design; smaller polish

- Toasts now match the Claude Design "Parsimony Toasts" file: icon, message, optional Undo, dismiss button, and a thin bar showing the time left (it pauses on hover; reduced motion uses a plain timer).
- The chat placeholder is shorter so it is not cut off on a phone.
- The My page code is loaded only when opened. The main script is about 205 kB gzipped (React, MUI, router and query), which is fine for this app, so the size warning stays as a note, not a setting to hide it.
