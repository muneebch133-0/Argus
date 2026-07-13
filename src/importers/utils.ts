import type { ArchitectureNode, SourceEvidence, SystemModel } from "../shared/schemas.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function boolValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

export function safeId(prefix: string, value: string): string {
  const cleaned = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${prefix}-${cleaned || "entity"}-${simpleHash(value)}`.slice(0, 80);
}

export function position(index: number): { x: number; y: number } {
  return {
    x: 80 + (index % 4) * 250,
    y: 90 + Math.floor(index / 4) * 170,
  };
}

export function sourceEvidence(
  source: SourceEvidence["source"],
  sourceName: string,
  locator: string,
  observation: string,
  confidence: SourceEvidence["confidence"] = "high",
): SourceEvidence {
  return { source, sourceName, locator, observation, confidence };
}

export function inferredAttributes(kind: ArchitectureNode["kind"]): ArchitectureNode["attributes"] {
  const attributes: ArchitectureNode["attributes"] = { auditLogging: false };
  if (
    ["application", "api", "service", "agent", "agent-orchestrator", "tool", "mcp-server"].includes(
      kind,
    )
  ) {
    attributes.inputValidation = false;
    attributes.rateLimited = false;
  }
  if (["data-store", "vector-store", "memory", "dataset"].includes(kind)) {
    attributes.encryptedAtRest = false;
  }
  if (["foundation-model", "model-api"].includes(kind)) {
    attributes.modelProvenanceVerified = false;
  }
  if (kind === "vector-store") attributes.tenantIsolation = false;
  if (["dataset", "rag-pipeline", "memory"].includes(kind)) {
    attributes.provenanceVerified = false;
  }
  if (["agent", "agent-orchestrator"].includes(kind)) attributes.circuitBreaker = false;
  if (["tool", "mcp-server"].includes(kind)) attributes.modelOutputValidated = false;
  return attributes;
}

export function draftModel(
  name: string,
  description: string,
  nodes: ArchitectureNode[],
  flows: SystemModel["flows"],
  systemKind: SystemModel["systemKind"] = "auto",
): SystemModel {
  return {
    schemaVersion: "1.0",
    name: name.slice(0, 120) || "Imported architecture",
    description: description.slice(0, 2000),
    systemKind,
    businessCriticality: "high",
    nodes,
    flows,
  };
}

export function fileStem(filename: string): string {
  return filename
    .replaceAll(/\.(json|ya?ml)$/gi, "")
    .replaceAll(/[-_]+/g, " ")
    .trim();
}
