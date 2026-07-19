from typing import Any

import httpx

from app.config import get_settings

APIFY_BASE = "https://api.apify.com/v2"


def _actor_path(actor: str) -> str:
    # Apify API uses ~ instead of / in actor ids: user~actor-name
    return actor.replace("/", "~")


class ApifyClient:
    def __init__(self, token: str | None = None) -> None:
        settings = get_settings()
        self.token = token or settings.apify_token
        self.settings = settings

    def _webhooks_payload(self, job_id: int) -> list[dict[str, Any]]:
        callback = f"{self.settings.public_base_url}/api/webhooks/apify"
        return [
            {
                "eventTypes": ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.ABORTED"],
                "requestUrl": f"{callback}?secret={self.settings.apify_webhook_secret}&job_id={job_id}",
            }
        ]

    def start_actor(self, actor: str, run_input: dict[str, Any], job_id: int) -> str:
        """Start an actor run with a completion webhook. Returns the Apify run id."""
        resp = httpx.post(
            f"{APIFY_BASE}/acts/{_actor_path(actor)}/runs",
            params={"token": self.token},
            json={**run_input, "webhooks": self._webhooks_payload(job_id)},
            timeout=30,
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()["data"]
        return str(data["id"])

    def get_run(self, run_id: str) -> dict[str, Any]:
        resp = httpx.get(
            f"{APIFY_BASE}/actor-runs/{run_id}", params={"token": self.token}, timeout=30
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()["data"]
        return data

    def get_dataset_items(self, dataset_id: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        offset = 0
        limit = 1000
        while True:
            resp = httpx.get(
                f"{APIFY_BASE}/datasets/{dataset_id}/items",
                params={"token": self.token, "offset": offset, "limit": limit, "clean": "true"},
                timeout=60,
            )
            resp.raise_for_status()
            batch = resp.json()
            items.extend(batch)
            if len(batch) < limit:
                return items
            offset += limit
