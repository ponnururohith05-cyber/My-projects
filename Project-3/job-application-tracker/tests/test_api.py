from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import get_database_url, get_db
from app.main import app
from app.models import Base, User


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    with TestingSession() as session:
        session.add(
            User(
                id=1,
                name="Test User",
                email="test@example.com",
                password_hash="not-used-in-tests",
            )
        )
        session.commit()

    def override_get_db() -> Generator[Session, None, None]:
        with TestingSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def create_application(
    client: TestClient,
    *,
    company: str,
    role: str = "Engineer",
    status: str = "Applied",
) -> dict[str, object]:
    response = client.post(
        "/applications",
        json={
            "user_id": 1,
            "company": company,
            "role": role,
            "status": status,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_application_crud_and_user_scoping(client: TestClient) -> None:
    created = create_application(client, company="Acme")
    application_id = created["id"]

    response = client.get("/applications", params={"user_id": 1, "page_size": 1})
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["company"] == "Acme"

    response = client.get(
        f"/applications/{application_id}", params={"user_id": 2}
    )
    assert response.status_code == 404

    response = client.patch(
        f"/applications/{application_id}",
        params={"user_id": 1},
        json={"status": "Interview", "notes": "First round"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Interview"

    response = client.delete(
        f"/applications/{application_id}", params={"user_id": 1}
    )
    assert response.status_code == 204
    assert client.get(
        f"/applications/{application_id}", params={"user_id": 1}
    ).status_code == 404


def test_filters_pagination_and_analytics(client: TestClient) -> None:
    create_application(client, company="Acme Labs", status="Interview")
    create_application(client, company="Acme Group", status="Offer")
    create_application(client, company="Other", status="Rejected")

    response = client.get(
        "/applications",
        params={"user_id": 1, "company": "acme", "page": 1, "page_size": 1},
    )
    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert response.json()["pages"] == 2
    assert len(response.json()["items"]) == 1

    status_counts = {
        item["status"]: item["count"]
        for item in client.get("/analytics/status", params={"user_id": 1}).json()
    }
    assert status_counts == {
        "Applied": 0,
        "Interview": 1,
        "Offer": 1,
        "Rejected": 1,
    }

    series = client.get(
        "/analytics/time-series", params={"user_id": 1, "months": 3}
    ).json()
    assert len(series["items"]) == 3
    assert sum(item["count"] for item in series["items"]) == 3


def test_invalid_status_and_pagination_are_rejected(client: TestClient) -> None:
    response = client.post(
        "/applications",
        json={"user_id": 1, "company": "Acme", "role": "Engineer", "status": "Pending"},
    )
    assert response.status_code == 422

    response = client.get(
        "/applications", params={"user_id": 1, "page_size": 101}
    )
    assert response.status_code == 422


def test_dashboard_and_static_assets_are_served(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Applications" in response.text
    assert 'id="application-form"' in response.text

    response = client.get("/static/app.js")
    assert response.status_code == 200
    assert "loadApplications" in response.text

    response = client.get("/static/styles.css")
    assert response.status_code == 200
    assert ".analytics-grid" in response.text

    response = client.get("/analytics")
    assert response.status_code == 200
    assert 'href="/analytics"' in response.text


def test_hosted_postgres_url_uses_psycopg_driver() -> None:
    url = get_database_url("postgres://tracker:secret@db.example.com:5432/tracker")
    assert url.drivername == "postgresql+psycopg"
    assert url.host == "db.example.com"
    assert url.database == "tracker"
    assert url.password == "secret"
