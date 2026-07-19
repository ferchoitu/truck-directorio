import hmac
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import ScrapingJob
from app.services.apify import ApifyClient
from app.services.ingest import ingest_dataset

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/apify")
def apify_webhook(
    payload: dict[str, Any],
    job_id: int = Query(...),
    secret: str = Query(default=""),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.apify_webhook_secret or not hmac.compare_digest(
        secret, settings.apify_webhook_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    job = db.get(ScrapingJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    event_type: str = payload.get("eventType", "")
    resource: dict[str, Any] = payload.get("resource") or {}

    if event_type != "ACTOR.RUN.SUCCEEDED":
        job.status = "failed"
        job.error_message = f"Apify run ended with event {event_type}"
        job.completed_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        return {"status": "acknowledged", "job_id": job.id}

    dataset_id = resource.get("defaultDatasetId")
    if not dataset_id:
        raise HTTPException(status_code=422, detail="Missing defaultDatasetId in payload")

    items = ApifyClient().get_dataset_items(dataset_id)
    is_safety = job.actor_id == settings.apify_actor_safety
    processed = ingest_dataset(db, items, safety=is_safety)

    job.status = "completed"
    job.total_records = len(items)
    job.processed_records = processed
    job.completed_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    return {"status": "ok", "job_id": job.id, "processed": processed}
