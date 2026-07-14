export const NODE_KINDS = [
  "actor",
  "external-system",
  "application",
  "api",
  "service",
  "data-store",
  "foundation-model",
  "model-api",
  "agent",
  "agent-orchestrator",
  "tool",
  "mcp-server",
  "rag-pipeline",
  "vector-store",
  "memory",
  "dataset",
  "model-registry",
  "guardrail",
  "human-approval",
  "observability",
] as const;

export const AI_NODE_KINDS = new Set<(typeof NODE_KINDS)[number]>([
  "foundation-model",
  "model-api",
  "agent",
  "agent-orchestrator",
  "tool",
  "mcp-server",
  "rag-pipeline",
  "vector-store",
  "memory",
  "dataset",
  "model-registry",
  "guardrail",
  "human-approval",
  "observability",
]);

export const AGENTIC_NODE_KINDS = new Set<(typeof NODE_KINDS)[number]>([
  "agent",
  "agent-orchestrator",
  "tool",
  "mcp-server",
  "memory",
  "human-approval",
]);

export const SEVERITIES = ["critical", "high", "medium", "low", "informational"] as const;
export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const SYSTEM_KINDS = ["auto", "standard", "ai", "agentic"] as const;
export const REVIEW_STATUSES = ["confirmed", "needs-review"] as const;
export const EVIDENCE_SOURCE_KINDS = [
  "manual",
  "interview",
  "openapi",
  "docker-compose",
  "kubernetes",
  "terraform-plan",
  "mcp-config",
  "ai-suggestion",
] as const;

export const NODE_KIND_LABELS: Record<(typeof NODE_KINDS)[number], string> = {
  actor: "User / actor",
  "external-system": "External system",
  application: "Application",
  api: "API",
  service: "Service",
  "data-store": "Data store",
  "foundation-model": "Foundation model",
  "model-api": "Model API",
  agent: "AI agent",
  "agent-orchestrator": "Agent orchestrator",
  tool: "Agent tool",
  "mcp-server": "MCP server",
  "rag-pipeline": "RAG pipeline",
  "vector-store": "Vector store",
  memory: "Agent memory",
  dataset: "Dataset",
  "model-registry": "Model registry",
  guardrail: "Guardrail",
  "human-approval": "Human approval",
  observability: "Evaluation / observability",
};

export const FRAMEWORK_VERSIONS = {
  stride: "Argus rules 0.1",
  attack: "live knowledge base",
  atlas: "2026.06",
  maestro: "2025",
  owaspLlm: "2025",
  owaspAgentic: "2026",
  nistAml: "AI 100-2 E2025",
  avid: "GPAI 2026",
} as const;
