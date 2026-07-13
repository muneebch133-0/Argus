import { describe, expect, it } from "vitest";
import paymentSampleJson from "../examples/payment-api.json";
import { createApp } from "../src/server/app.js";

const app = createApp({
  liveIntelligence: false,
  allowedOrigins: ["http://localhost:5173"],
  requestTimeoutMs: 1000,
});

describe("Argus API", () => {
  it("reports health and security headers", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toMatchObject({ status: "ok", service: "argus" });
  });

  it("analyses a valid architecture", async () => {
    const response = await app.request("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: paymentSampleJson,
        options: { liveVulnerabilityEnrichment: false, includeInformational: false },
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode: string; threats: unknown[] };
    expect(body.mode).toBe("standard");
    expect(body.threats.length).toBeGreaterThan(0);
  });

  it("rejects invalid models with actionable validation details", async () => {
    const response = await app.request("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: { name: "missing schema" } }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe("Architecture model is invalid");
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("fails closed when live intelligence is disabled", async () => {
    const response = await app.request("/api/intelligence/cves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cveIds: ["CVE-2021-44228"] }),
    });
    expect(response.status).toBe(503);
  });
});
