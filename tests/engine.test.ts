import { describe, expect, it } from "vitest";
import agenticSampleJson from "../examples/agentic-rag.json";
import paymentSampleJson from "../examples/payment-api.json";
import { analyzeSystem } from "../src/engine/analyze.js";
import { type SystemModel, systemModelSchema } from "../src/shared/schemas.js";

const agenticSample = systemModelSchema.parse(agenticSampleJson);
const paymentSample = systemModelSchema.parse(paymentSampleJson);

function hardenedModel(): SystemModel {
  return systemModelSchema.parse({
    schemaVersion: "1.0",
    name: "Hardened internal service",
    description: "A minimal model where required controls are evidenced.",
    systemKind: "standard",
    businessCriticality: "medium",
    nodes: [
      {
        id: "caller",
        name: "Trusted caller",
        kind: "service",
        description: "",
        trustZone: "application",
        exposure: "internal",
        dataClassification: "internal",
        position: { x: 0, y: 0 },
        attributes: { auditLogging: true, rateLimited: true, inputValidation: true },
      },
      {
        id: "store",
        name: "Encrypted store",
        kind: "data-store",
        description: "",
        trustZone: "data",
        exposure: "internal",
        dataClassification: "confidential",
        position: { x: 200, y: 0 },
        attributes: { encryptedAtRest: true },
      },
    ],
    flows: [
      {
        id: "trusted-flow",
        source: "caller",
        target: "store",
        label: "Stored data",
        protocol: "TLS",
        authenticated: true,
        encrypted: true,
        carriesSensitiveData: true,
        untrustedContent: false,
        crossesTrustBoundary: true,
      },
    ],
  });
}

describe("Argus threat engine", () => {
  it("auto-detects and analyses an agentic RAG architecture", () => {
    const result = analyzeSystem(agenticSample);
    expect(result.mode).toBe("agentic");
    expect(result.summary.total).toBeGreaterThan(8);
    expect(result.threats.some((threat) => threat.category.includes("Prompt Injection"))).toBe(
      true,
    );
    expect(
      result.threats.some((threat) => threat.category === "Memory and Context Poisoning"),
    ).toBe(true);
    expect(result.threats.some((threat) => threat.category.includes("Excessive Agency"))).toBe(
      true,
    );
    expect(result.frameworkCoverage.map((item) => item.framework)).toEqual(
      expect.arrayContaining([
        "STRIDE",
        "MITRE ATLAS",
        "OWASP LLM Top 10",
        "OWASP Agentic Top 10",
        "CSA MAESTRO",
      ]),
    );
  });

  it("applies traditional STRIDE analysis without AI framework noise", () => {
    const result = analyzeSystem(paymentSample);
    expect(result.mode).toBe("standard");
    expect(result.threats.some((threat) => threat.category === "Spoofing")).toBe(true);
    expect(
      result.threats.some((threat) => threat.category.includes("Information Disclosure")),
    ).toBe(true);
    expect(result.threats.some((threat) => threat.category === "Repudiation")).toBe(true);
    expect(
      result.threats
        .flatMap((threat) => threat.frameworks)
        .some((ref) => ref.framework === "OWASP LLM Top 10"),
    ).toBe(false);
  });

  it("does not report missing controls when they are evidenced", () => {
    const result = analyzeSystem(hardenedModel());
    expect(result.mode).toBe("standard");
    expect(result.threats).toHaveLength(0);
    expect(result.controls).toHaveLength(0);
  });

  it("produces stable finding IDs for the same architecture evidence", () => {
    const first = analyzeSystem(paymentSample).threats.map((threat) => threat.id);
    const second = analyzeSystem(paymentSample).threats.map((threat) => threat.id);
    expect(first).toEqual(second);
  });

  it("keeps candidate CVEs explicitly unconfirmed", () => {
    const model = structuredClone(hardenedModel());
    const firstNode = model.nodes[0];
    if (!firstNode) throw new Error("Expected a fixture node");
    firstNode.attributes.cveIds = ["CVE-2021-44228"];
    const result = analyzeSystem(model);
    const finding = result.threats.find((threat) => threat.title.includes("CVE-2021-44228"));
    expect(finding?.findingType).toBe("potential-vulnerability");
    expect(finding?.confidence).toBe("low");
    expect(finding?.assumptions.join(" ")).toContain("does not prove");
  });
});
