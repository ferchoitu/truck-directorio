"""Verify the Apify connection: token validity and access to the three actors.

Usage: python -m app.check_apify
"""

import sys

import httpx

from app.config import get_settings
from app.services.apify import ApifyClient


def main() -> int:
    settings = get_settings()
    if not settings.apify_token or settings.apify_token == "your_apify_token":
        print("FAIL: APIFY_TOKEN is not set. Add it to backend/.env")
        print("      Get it at https://console.apify.com/settings/integrations")
        return 1

    client = ApifyClient()
    try:
        user = client.get_user()
    except httpx.HTTPStatusError as exc:
        print(f"FAIL: token rejected by Apify ({exc.response.status_code})")
        print("      Check APIFY_TOKEN in backend/.env — get it at "
              "https://console.apify.com/settings/integrations")
        return 1
    plan = (user.get("plan") or {}).get("id", "unknown")
    print(f"OK: authenticated as '{user.get('username')}' (plan: {plan})")

    ok = True
    for label, actor in [
        ("main", settings.apify_actor_main),
        ("safety", settings.apify_actor_safety),
        ("new", settings.apify_actor_new),
    ]:
        try:
            info = client.get_actor(actor)
            print(f"OK: {label} actor {actor} (id {info['id']})")
        except httpx.HTTPStatusError as exc:
            print(f"FAIL: {label} actor {actor} not accessible ({exc.response.status_code})")
            ok = False

    if not settings.apify_webhook_secret:
        print("WARN: APIFY_WEBHOOK_SECRET is empty — webhooks will be rejected")
    if "localhost" in settings.public_base_url:
        print(
            "WARN: PUBLIC_BASE_URL is localhost — Apify webhooks cannot reach it; "
            "use the Railway URL (or a tunnel) for real runs"
        )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
