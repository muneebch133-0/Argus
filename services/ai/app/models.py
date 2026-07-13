from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class InterviewProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    systemKind: Literal["auto", "standard", "ai", "agentic"] = "auto"
    businessCriticality: Literal["low", "medium", "high", "mission-critical"] = "high"
    primaryUsers: str = Field(default="Customers", max_length=500)
    internetExposed: bool = True
    sensitiveData: bool = False
    dataStores: str = Field(default="", max_length=1000)
    externalSystems: str = Field(default="", max_length=1000)
    usesAi: bool = False
    usesRag: bool = False
    usesAgents: bool = False
    agentTools: str = Field(default="", max_length=1000)
    highImpactActions: bool = False
    authentication: bool = True
    encryption: bool = True
    auditLogging: bool = False
    humanApproval: bool = False
    additionalContext: str = Field(default="", max_length=2000)


class InterviewReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: InterviewProfile


class InterviewQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-zA-Z0-9_-]+$", min_length=1, max_length=80)
    question: str = Field(min_length=1, max_length=400)
    whyItMatters: str = Field(min_length=1, max_length=600)
    category: Literal["scope", "identity", "data", "boundary", "ai", "operations"]


class GeneratedInterviewReview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=1200)
    questions: list[InterviewQuestion] = Field(max_length=3)
    warnings: list[str] = Field(max_length=10)


class InterviewReview(GeneratedInterviewReview):
    mode: Literal["deterministic", "ai"]
