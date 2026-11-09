from fastapi import FastAPI

from app.routers import auth, entries, health, stats

app = FastAPI(title="Parsimony API", version="0.1.0")

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(entries.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
