"""Build actor-specific run input, matching each actor's published input schema.

Schemas verified against the Apify API (GET /v2/acts/{actor}/builds/default) on 2026-07-18:

- jungle_synthesizer/fmcsa-dot-crawler: dot_start (int), max_results (int),
  is_premium_mode (bool, unlocks emails/crash history/safety ratings)
- parseforge/fmcsa-carrier-safety-scraper: dotNumbers (list[str]), maxItems (int)
- curative_blanket/fmcsa-new-carrier-feed: daysBack (int), incremental (bool),
  maxResults (int)
"""

from typing import Any

from app.schemas import ScrapingStartRequest


def build_run_input(body: ScrapingStartRequest) -> dict[str, Any]:
    if body.actor == "new":
        return {
            "daysBack": body.days_back,
            "incremental": True,
            "maxResults": 10_000,
        }

    if body.usdot_range_start is None or body.usdot_range_end is None:
        raise ValueError("usdot_range_start and usdot_range_end are required for this actor")
    if body.usdot_range_end < body.usdot_range_start:
        raise ValueError("usdot_range_end must be >= usdot_range_start")

    count = body.usdot_range_end - body.usdot_range_start + 1
    if body.actor == "main":
        return {
            "dot_start": body.usdot_range_start,
            "max_results": count,
            "is_premium_mode": body.premium,
        }

    # safety
    return {
        "dotNumbers": [str(n) for n in range(body.usdot_range_start, body.usdot_range_end + 1)],
        "maxItems": count,
    }
