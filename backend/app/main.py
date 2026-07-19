import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import carriers, health, scraping, webhooks


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    if os.environ.get("ENABLE_UPDATER", "").lower() in ("1", "true", "yes"):
        from app.updater import updater_loop

        task = asyncio.create_task(updater_loop())
    yield
    if task:
        task.cancel()


app = FastAPI(title="CarrierCheck API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(carriers.router)
app.include_router(scraping.router)
app.include_router(webhooks.router)
