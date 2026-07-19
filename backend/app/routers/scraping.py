from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import ScrapingJob
from app.schemas import ScrapingJobOut, ScrapingStartRequest
from app.services.apify import ApifyClient

router = APIRouter(prefix="/api/scraping", tags=["scraping"])


@router.post("/start", response_model=ScrapingJobOut, status_code=201)
def start_scraping(body: ScrapingStartRequest, db: Session = Depends(get_db)) -> ScrapingJobOut:
    if body.usdot_range_end < body.usdot_range_start:
        raise HTTPException(status_code=422, detail="usdot_range_end must be >= usdot_range_start")

    settings = get_settings()
    actor = {
        "main": settings.apify_actor_main,
        "safety": settings.apify_actor_safety,
        "new": settings.apify_actor_new,
    }[body.actor]

    job = ScrapingJob(
        actor_id=actor,
        status="pending",
        usdot_range_start=body.usdot_range_start,
        usdot_range_end=body.usdot_range_end,
    )
    db.add(job)
    db.commit()

    usdot_numbers = [
        str(n) for n in range(body.usdot_range_start, body.usdot_range_end + 1)
    ]
    try:
        run_id = ApifyClient().start_actor(
            actor, {"usdotNumbers": usdot_numbers}, job_id=job.id
        )
    except Exception as exc:  # noqa: BLE001 - persist failure reason on the job
        job.status = "failed"
        job.error_message = str(exc)[:2000]
        db.commit()
        raise HTTPException(status_code=502, detail="Failed to start Apify run") from exc

    job.apify_run_id = run_id
    job.status = "running"
    job.started_at = datetime.now(UTC).replace(tzinfo=None)
    db.commit()
    return ScrapingJobOut.model_validate(job)


@router.get("/jobs", response_model=list[ScrapingJobOut])
def list_jobs(db: Session = Depends(get_db)) -> list[ScrapingJobOut]:
    jobs = db.scalars(select(ScrapingJob).order_by(ScrapingJob.id.desc()).limit(100)).all()
    return [ScrapingJobOut.model_validate(job) for job in jobs]


@router.get("/jobs/{job_id}", response_model=ScrapingJobOut)
def get_job(job_id: int, db: Session = Depends(get_db)) -> ScrapingJobOut:
    job = db.get(ScrapingJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return ScrapingJobOut.model_validate(job)
