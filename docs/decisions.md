# Decisions

## Day 1
- Postgres from day one (dev and prod); SQLite only for fast tests later.
- Backend routes live under `/api` so Nginx can serve the frontend at `/` and proxy `/api`.
- Config via environment variables (pydantic-settings); `.env` is git-ignored, `.env.example` is committed.
