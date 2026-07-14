import { describe, expect, it } from "vitest";
import { buildInterviewDraft } from "../src/interview/buildDraft.js";
import { deterministicInterviewReview } from "../src/interview/review.js";
import type { InterviewProfile } from "../src/shared/schemas.js";

const profile: InterviewProfile = {
  name: "Refund agent",
  description: "Assists customers and can issue approved refunds.",
  systemKind: "auto",
  businessCriticality: "high",
  primaryUsers: "Customers",
  internetExposed: true,
  sensitiveData: true,
  dataStores: "Customer database",
  externalSystems: "Identity provider",
  usesAi: true,
  usesRag: true,
  usesAgents: true,
  agentTools: "Refund API, Email sender",
  highImpactActions: true,
  authentication: true,
  encryption: true,
  auditLogging: true,
  humanApproval: true,
  additionalContext: "Refunds over a threshold require approval.",
};

describe("architecture interview", () => {
  it("builds an evidence-gated agentic draft", () => {
    const draft = buildInterviewDraft(profile);
    expect(draft.model.systemKind).toBe("agentic");
    expect(draft.model.nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(["agent", "model-api", "rag-pipeline", "human-approval", "tool"]),
    );
    expect(draft.model.nodes.every((node) => node.reviewStatus === "needs-review")).toBe(true);
    expect(draft.model.flows.every((flow) => flow.evidence[0]?.source === "interview")).toBe(true);
  });

  it("asks about missing consequential-action approval", () => {
    const review = deterministicInterviewReview({
      ...profile,
      agentTools: "",
      auditLogging: false,
      humanApproval: false,
    });
    expect(review.questions.map((question) => question.id)).toEqual(
      expect.arrayContaining(["agent-tools", "consequential-approval"]),
    );
    expect(review.mode).toBe("deterministic");
  });
});
