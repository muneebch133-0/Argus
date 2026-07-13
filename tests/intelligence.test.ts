import { describe, expect, it, vi } from "vitest";
import { enrichCves } from "../src/engine/intelligence.js";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("vulnerability intelligence", () => {
  it("correlates NVD, CISA KEV and EPSS without claiming asset applicability", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("known_exploited_vulnerabilities")) {
        return jsonResponse({
          vulnerabilities: [
            {
              cveID: "CVE-2021-44228",
              dateAdded: "2021-12-10",
              knownRansomwareCampaignUse: "Known",
              requiredAction: "Apply updates per vendor instructions.",
            },
          ],
        });
      }
      if (url.includes("api.first.org")) {
        return jsonResponse({
          data: [{ cve: "CVE-2021-44228", epss: "0.975", percentile: "0.999", date: "2026-07-14" }],
        });
      }
      return jsonResponse({
        vulnerabilities: [
          {
            cve: {
              published: "2021-12-10T10:15:00.000",
              lastModified: "2025-10-27T14:07:33.100",
              descriptions: [{ lang: "en", value: "A test vulnerability description." }],
              weaknesses: [{ description: [{ lang: "en", value: "CWE-502" }] }],
              metrics: {
                cvssMetricV31: [{ cvssData: { baseScore: 10, baseSeverity: "CRITICAL" } }],
              },
            },
          },
        ],
      });
    });

    const [record] = await enrichCves(["cve-2021-44228"], {
      fetchImpl: fetchMock,
      timeoutMs: 1000,
    });
    expect(record?.cveId).toBe("CVE-2021-44228");
    expect(record?.nvd.found).toBe(true);
    expect(record?.nvd.cvssScore).toBe(10);
    expect(record?.nvd.cwes).toContain("CWE-502");
    expect(record?.kev.listed).toBe(true);
    expect(record?.epss.probability).toBe(0.975);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns partial results when one intelligence source fails", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("api.first.org")) return new Response("unavailable", { status: 503 });
      if (url.includes("known_exploited_vulnerabilities"))
        return jsonResponse({ vulnerabilities: [] });
      return jsonResponse({ vulnerabilities: [] });
    });
    const [record] = await enrichCves(["CVE-2025-12345"], {
      fetchImpl: fetchMock,
      timeoutMs: 1000,
    });
    expect(record?.nvd.found).toBe(false);
    expect(record?.errors.some((error) => error.startsWith("FIRST EPSS"))).toBe(true);
  });
});
