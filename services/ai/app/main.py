import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException

from .models import InterviewReview, InterviewReviewRequest
from .review import review_profile

app = FastAPI(
    title="Argus AI Interviewer",
    version="0.2.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def verify_internal_token(x_argus_internal_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("ARGUS_INTERNAL_TOKEN")
    if expected and (
        x_argus_internal_token is None
        or not hmac.compare_digest(x_argus_internal_token, expected)
    ):
        raise HTTPException(status_code=401, detail="Invalid internal service token")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "argus-ai-interviewer",
        "provider": os.getenv("ARGUS_AI_PROVIDER", "disabled").lower(),
    }


@app.post(
    "/v1/interview/review",
    response_model=InterviewReview,
    dependencies=[Depends(verify_internal_token)],
)
def review(request: InterviewReviewRequest) -> InterviewReview:
    return review_profile(request.profile)
