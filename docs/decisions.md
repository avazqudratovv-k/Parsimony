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
