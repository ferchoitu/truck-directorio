from slugify import slugify as _slugify


def carrier_slug(legal_name: str | None, usdot_number: str) -> str:
    """Kebab-case slug, always suffixed with the USDOT number for uniqueness."""
    base = _slugify(legal_name or "carrier", max_length=200) or "carrier"
    return f"{base}-usdot-{usdot_number}"


def usdot_from_slug(slug: str) -> str | None:
    marker = "-usdot-"
    if marker not in slug:
        return None
    tail = slug.rsplit(marker, 1)[1]
    return tail if tail.isdigit() else None
