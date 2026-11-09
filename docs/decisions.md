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
