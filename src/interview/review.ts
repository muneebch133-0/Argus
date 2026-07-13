import type { InterviewProfile, InterviewReview } from "../shared/schemas.js";

export function deterministicInterviewReview(profile: InterviewProfile): InterviewReview {
  const candidates: InterviewReview["questions"] = [];
  if (profile.internetExposed && !profile.authentication) {
    candidates.push({
      id: "internet-identity",
      category: "identity",
      question: "How are internet callers identified, and which component enforces authentication?",
      whyItMatters:
        "The current answers describe an internet-facing system without evidenced authentication.",
    });
  }
  if (profile.sensitiveData && !profile.encryption) {
    candidates.push({
      id: "sensitive-data-protection",
      category: "data",
      question:
        "Where is sensitive data stored or transmitted, and what encryption and key boundaries protect it?",
      whyItMatters: "Sensitive data is in scope but encryption is not currently evidenced.",
    });
  }
  if (profile.usesAgents && !profile.agentTools.trim()) {
    candidates.push({
      id: "agent-tools",
      category: "ai",
      question:
        "Which tools can the agent invoke, and what identity and permissions does each tool use?",
      whyItMatters:
        "Agent risk depends heavily on effective tool permissions and downstream impact.",
    });
  }
  if (profile.usesAgents && profile.highImpactActions && !profile.humanApproval) {
    candidates.push({
      id: "consequential-approval",
      category: "ai",
      question:
        "What prevents the agent from executing irreversible or privileged actions without accountable approval?",
      whyItMatters:
        "The agent can perform high-impact actions without an evidenced approval boundary.",
    });
  }
  if (profile.usesRag && !profile.dataStores.trim()) {
    candidates.push({
      id: "rag-sources",
      category: "data",
      question:
        "Which source systems feed RAG, and how are document permissions and provenance retained during retrieval?",
      whyItMatters:
        "RAG is enabled but its sources, tenant boundaries and provenance are not described.",
    });
  }
  if (!profile.auditLogging) {
    candidates.push({
      id: "audit-evidence",
      category: "operations",
      question:
        "Which logs link users, model calls, retrieved sources, agent decisions, approvals and tool outcomes?",
      whyItMatters: "End-to-end audit evidence is not currently represented.",
    });
  }
  if (candidates.length === 0) {
    candidates.push({
      id: "failure-modes",
      category: "operations",
      question:
        "What are the most damaging credible failure modes, and how would operators detect and stop them?",
      whyItMatters:
        "Operational failure and response paths often reveal controls not visible in a component inventory.",
    });
  }
  const capabilities = [
    profile.internetExposed ? "internet-facing" : "internally exposed",
    profile.usesAgents ? "agentic" : profile.usesAi ? "AI-enabled" : "conventional",
    profile.sensitiveData ? "processing sensitive data" : "without sensitive data confirmed",
  ];
  return {
    mode: "deterministic",
    summary: `${profile.name} is described as ${capabilities.join(", ")}. The questions below target the highest-value missing evidence before accepting the generated model.`,
    questions: candidates.slice(0, 3),
    warnings: [
      "This review is generated from supplied answers and does not independently verify deployed controls.",
    ],
  };
}
