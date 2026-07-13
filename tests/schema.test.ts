import { describe, expect, it } from "vitest";
import agenticSampleJson from "../examples/agentic-rag.json";
import { systemModelSchema } from "../src/shared/schemas.js";

describe("architecture schema", () => {
  it("accepts the versioned example model", () => {
    const result = systemModelSchema.safeParse(agenticSampleJson);
    expect(result.success).toBe(true);
  });

  it("rejects dangling data-flow references", () => {
    const invalid = structuredClone(agenticSampleJson);
    const firstFlow = invalid.flows[0];
    if (!firstFlow) throw new Error("Expected a fixture flow");
    firstFlow.target = "missing-node";
    const result = systemModelSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain("existing nodes");
  });

  it("rejects duplicate component identifiers", () => {
    const invalid = structuredClone(agenticSampleJson);
    const firstNode = invalid.nodes[0];
    const secondNode = invalid.nodes[1];
    if (!firstNode || !secondNode) throw new Error("Expected two fixture nodes");
    secondNode.id = firstNode.id;
    const result = systemModelSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
