# Parsimony

An AI expense tracker: type it, say it, or photograph a receipt, and a model turns it into structured data.

> Work in progress. Receipt photos are read and never stored.

## Run locally

```bash
cp .env.example .env        # then edit values
docker compose up --build
curl http://localhost:8000/api/health   # -> {"status":"ok"}
```

## Layout

`backend/` FastAPI API · `frontend/` React app · `ml/` fine-tuning and evaluation · `docs/` notes
