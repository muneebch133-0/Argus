import {
  type AnalysisResult,
  analysisResultSchema,
  type InterviewProfile,
  type InterviewReview,
  interviewReviewSchema,
  type SystemModel,
} from "../../shared/schemas.js";

interface ApiErrorPayload {
  error?: string;
  detail?: string;
  issues?: Array<{ path?: string; message?: string }>;
}

export async function analyzeArchitecture(model: SystemModel): Promise<AnalysisResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      options: { liveVulnerabilityEnrichment: false, includeInformational: false },
    }),
  });
  if (!response.ok) {
    let payload: ApiErrorPayload = {};
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      // Preserve the status-based fallback below.
    }
    const issue = payload.issues?.[0];
    throw new Error(
      [payload.error ?? `Analysis failed with HTTP ${response.status}`, issue?.path, issue?.message]
        .filter(Boolean)
        .join(": "),
    );
  }
  return analysisResultSchema.parse(await response.json());
}

export async function reviewInterview(profile: InterviewProfile): Promise<InterviewReview> {
  const response = await fetch("/api/interview/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (!response.ok) {
    throw new Error(`Interview review failed with HTTP ${response.status}`);
  }
  return interviewReviewSchema.parse(await response.json());
}
