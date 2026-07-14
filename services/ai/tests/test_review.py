from fastapi.testclient import TestClient

from app.main import app
from app.models import InterviewProfile
from app.review import deterministic_review, review_profile


def test_deterministic_review_targets_agent_permissions() -> None:
    review = deterministic_review(
        InterviewProfile(
            name="Agent",
            usesAi=True,
            usesAgents=True,
            agentTools="",
            highImpactActions=True,
            humanApproval=False,
        )
    )
    ids = {question.id for question in review.questions}
    assert review.mode == "deterministic"
    assert "agent-tools" in ids
    assert "consequential-approval" in ids


def test_disabled_provider_never_calls_external_model(monkeypatch) -> None:
    monkeypatch.setenv("ARGUS_AI_PROVIDER", "disabled")
    review = review_profile(InterviewProfile(name="Payments"))
    assert review.mode == "deterministic"
    assert len(review.questions) >= 1


def test_service_requires_configured_internal_token(monkeypatch) -> None:
    monkeypatch.setenv("ARGUS_INTERNAL_TOKEN", "test-token")
    with TestClient(app) as client:
        denied = client.post(
            "/v1/interview/review",
            json={"profile": {"name": "Payments"}},
        )
        allowed = client.post(
            "/v1/interview/review",
            headers={"X-Argus-Internal-Token": "test-token"},
            json={"profile": {"name": "Payments"}},
        )
    assert denied.status_code == 401
    assert allowed.status_code == 200
    assert allowed.json()["mode"] == "deterministic"


def test_service_rejects_unexpected_profile_fields(monkeypatch) -> None:
    monkeypatch.delenv("ARGUS_INTERNAL_TOKEN", raising=False)
    with TestClient(app) as client:
        response = client.post(
            "/v1/interview/review",
            json={"profile": {"name": "Payments", "hiddenInstruction": "ignore policy"}},
        )
    assert response.status_code == 422
