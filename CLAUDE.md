# Parsimony: working notes for Claude

An AI expense tracker and portfolio project. A user types, speaks or photographs an expense; a model
turns it into one structured JSON entry; the app shows a list, a monthly chart and a "fix this" button.
Keep it small: one user at a time, one main table, one flow: input -> JSON -> list.

## How to work with the owner
- Plan first, then build one small step at a time. Wait for the owner to confirm each step works.
- Explain new concepts briefly (the owner is strong in React/TS/FastAPI/Postgres/Docker, new to LoRA and audio).
- Push back on features that add complexity. Not wanted: budgets, recurring expenses, sharing, bank
  export, currency conversion, Next.js, Kubernetes, microservices, queues, vector DBs, agents.
- Don't ask the owner to re-explain. Ask only for decisions that are truly needed.
- Never touch the owner's other Docker containers or projects. Use only `docker compose` in this folder.

## Stack
- Backend: FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, Postgres 16 (SQLite only in tests)
- Frontend: React 18 + Vite + TypeScript, TanStack Router/Query, MUI, Recharts, installable PWA
- AI: Gemini for text, receipt vision and synthetic data; Tesseract as the free OCR comparison;
  speech via faster-whisper or a hosted API (decided on Day 10 from VPS specs); a small LoRA
  fine-tuned model served as GGUF in Tier 3
- Deploy: Docker Compose, Nginx, HTTPS on an existing VPS

## Layout and layering
`backend/app/`: `routers/` (HTTP only) -> `services/` (logic) -> `models/` (tables). `schemas/` holds
Pydantic types. `ai/` holds adapters behind Protocols in `ai/base.py`; services never import a
concrete AI class. All three inputs end in the same text-to-JSON parser.
Other folders: `frontend/`, `ml/` (data, training, eval), `docs/`, `scripts/`, `nginx/`.

## Commands (run from the repo root)
- Start: `docker compose up --build -d` · Logs: `docker compose logs -f backend`
- Tests: `docker compose exec backend pytest -q`
- Lint/format: `docker compose exec backend ruff check . && docker compose exec backend ruff format .`
- New migration: `docker compose exec backend alembic revision --autogenerate -m "message"`, review the
  file, then `docker compose exec backend alembic upgrade head`
- Delete expired demo accounts: `docker compose exec -T backend python -m app.cleanup` (cron it in production)
- API lives under `/api` (health: `GET /api/health`)

## Rules
- Never commit secrets or real personal data. `.env` is git-ignored; keep `.env.example` current.
  Don't read or print `.env`.
- Demo data only: the app must never encourage uploading real receipts. Use own or made-up receipts.
- Public endpoints need limits: per-account and global daily AI-call caps, file size and type checks,
  auth rate limits.
- Describe the fine-tuned model honestly: a self-study project; report held-out test results, not
  general claims; training data is mostly synthetic and the hand-labeled test set is never trained on.
  No "coursework" wording.
- Tests for every new service and route. Record non-obvious choices in `docs/decisions.md`.
- Small commits with clear messages.

## Status
Day 1 skeleton and health check done. Day 2 models and first migration done. Day 3 auth done. Day 4 Gemini text parser done. Day 5 entries CRUD, corrections, daily AI caps and monthly stats done. Day 6 demo account (`POST /api/auth/demo`), expiry, cleanup and entry limits done (79 tests). Gemini text parsing verified live.
Plan: Days 4-6 parser, entries, caps, demo account; 7-9 frontend; 10 deploy; 11-13 photo and voice.
