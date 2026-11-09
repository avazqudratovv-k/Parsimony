from fastapi import FastAPI

from app.routers import auth, entries, health

app = FastAPI(title="Parsimony API", version="0.1.0")

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(entries.router, prefix="/api")
