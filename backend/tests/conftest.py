import os

os.environ.setdefault("APIFY_WEBHOOK_SECRET", "test-secret")
os.environ.setdefault("SCRAPING_API_KEY", "test-scraping-key")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.security import reset_scraping_rate_limiter

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db() -> Session:
    Base.metadata.create_all(engine)
    session = TestingSession()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db: Session) -> TestClient:
    reset_scraping_rate_limiter()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, headers={"X-API-Key": "test-scraping-key"}) as test_client:
        yield test_client
    app.dependency_overrides.clear()
