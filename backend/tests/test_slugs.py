from app.services.slugs import carrier_slug, usdot_from_slug


def test_carrier_slug_kebab_case() -> None:
    assert carrier_slug("ACME Trucking, LLC.", "123456") == "acme-trucking-llc-usdot-123456"


def test_carrier_slug_handles_missing_name() -> None:
    assert carrier_slug(None, "99") == "carrier-usdot-99"


def test_usdot_from_slug_roundtrip() -> None:
    assert usdot_from_slug(carrier_slug("Some Carrier", "42")) == "42"


def test_usdot_from_slug_invalid() -> None:
    assert usdot_from_slug("not-a-carrier-slug") is None
