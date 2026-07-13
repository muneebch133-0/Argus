import type { FrameworkRef } from "../shared/schemas.js";

const SOURCES = {
  stride: "https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html",
  attack: "https://attack.mitre.org/",
  atlas: "https://atlas.mitre.org/",
  maestro:
    "https://cloudsecurityalliance.org/blog/2025/02/06/agentic-ai-threat-modeling-framework-maestro",
  owaspLlm: "https://genai.owasp.org/llm-top-10/",
  owaspAgentic: "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/",
  nistAml: "https://csrc.nist.gov/pubs/ai/100/2/e2025/final",
  avid: "https://docs.avidml.org/database/introduction",
  d3fend: "https://d3fend.mitre.org/",
  nist: "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
  asvs: "https://owasp.org/www-project-application-security-verification-standard/",
} as const;

export function frameworkRef(
  framework: string,
  id: string,
  name: string,
  version: string,
  url: string,
  rationale: string,
): FrameworkRef {
  return { framework, id, name, version, url, rationale };
}

export function strideRef(category: string, rationale: string): FrameworkRef {
  return frameworkRef("STRIDE", category, category, "Argus rules 0.1", SOURCES.stride, rationale);
}

export function attackRef(id: string, name: string, rationale: string): FrameworkRef {
  return frameworkRef(
    "MITRE ATT&CK",
    id,
    name,
    "live",
    `${SOURCES.attack}techniques/${id}/`,
    rationale,
  );
}

export function atlasRef(name: string, rationale: string): FrameworkRef {
  return frameworkRef(
    "MITRE ATLAS",
    `ATLAS:${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    name,
    "2026.06",
    SOURCES.atlas,
    rationale,
  );
}

export function maestroRef(layer: string, rationale: string): FrameworkRef {
  return frameworkRef("CSA MAESTRO", layer, layer, "2025", SOURCES.maestro, rationale);
}

export function owaspLlmRef(id: string, name: string, rationale: string): FrameworkRef {
  const slugById: Record<string, string> = {
    "LLM01:2025": "llm01-prompt-injection",
    "LLM02:2025": "llm02-insecure-output-handling",
    "LLM03:2025": "llm03-training-data-poisoning",
    "LLM10:2025": "llm102025-unbounded-consumption",
  };
  const slug = slugById[id];
  return frameworkRef(
    "OWASP LLM Top 10",
    id,
    name,
    "2025",
    slug ? `https://genai.owasp.org/llmrisk/${slug}/` : SOURCES.owaspLlm,
    rationale,
  );
}

export function owaspAgenticRef(id: string, name: string, rationale: string): FrameworkRef {
  return frameworkRef("OWASP Agentic Top 10", id, name, "2026", SOURCES.owaspAgentic, rationale);
}

export function nistAmlRef(name: string, rationale: string): FrameworkRef {
  return frameworkRef(
    "NIST Adversarial ML",
    `NIST-AML:${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    name,
    "AI 100-2 E2025",
    SOURCES.nistAml,
    rationale,
  );
}

export function controlRef(
  id: string,
  name: string,
  source: "NIST" | "OWASP ASVS" | "MITRE D3FEND",
): FrameworkRef {
  const url =
    source === "NIST" ? SOURCES.nist : source === "OWASP ASVS" ? SOURCES.asvs : SOURCES.d3fend;
  return frameworkRef(
    source,
    id,
    name,
    "current",
    url,
    "Supports implementation and verification of this control objective.",
  );
}

export const sourceUrls = SOURCES;
