export interface VulnerabilityIntelligence {
  cveId: string;
  nvd: {
    found: boolean;
    description?: string;
    published?: string;
    lastModified?: string;
    cvssScore?: number;
    cvssSeverity?: string;
    cwes: string[];
    url: string;
  };
  kev: {
    listed: boolean;
    dateAdded?: string;
    knownRansomwareUse?: string;
    requiredAction?: string;
  };
  epss: {
    probability?: number;
    percentile?: number;
    date?: string;
  };
  errors: string[];
}

export interface IntelligenceOptions {
  fetchImpl?: typeof fetch;
  nvdApiKey?: string;
  timeoutMs?: number;
}

const CISA_KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const EPSS_URL = "https://api.first.org/data/v1/epss";
const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "Argus-Threat-Modeler/0.1", ...headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseKev(payload: unknown): Map<string, VulnerabilityIntelligence["kev"]> {
  const result = new Map<string, VulnerabilityIntelligence["kev"]>();
  if (!isRecord(payload) || !Array.isArray(payload.vulnerabilities)) return result;
  for (const raw of payload.vulnerabilities) {
    if (!isRecord(raw)) continue;
    const cveId = getString(raw, "cveID")?.toUpperCase();
    if (!cveId) continue;
    const dateAdded = getString(raw, "dateAdded");
    const knownRansomwareUse = getString(raw, "knownRansomwareCampaignUse");
    const requiredAction = getString(raw, "requiredAction");
    result.set(cveId, {
      listed: true,
      ...(dateAdded ? { dateAdded } : {}),
      ...(knownRansomwareUse ? { knownRansomwareUse } : {}),
      ...(requiredAction ? { requiredAction } : {}),
    });
  }
  return result;
}

function parseEpss(payload: unknown): Map<string, VulnerabilityIntelligence["epss"]> {
  const result = new Map<string, VulnerabilityIntelligence["epss"]>();
  if (!isRecord(payload) || !Array.isArray(payload.data)) return result;
  for (const raw of payload.data) {
    if (!isRecord(raw)) continue;
    const cveId = getString(raw, "cve")?.toUpperCase();
    if (!cveId) continue;
    const probability = getNumber(raw, "epss");
    const percentile = getNumber(raw, "percentile");
    const date = getString(raw, "date");
    result.set(cveId, {
      ...(probability !== undefined ? { probability } : {}),
      ...(percentile !== undefined ? { percentile } : {}),
      ...(date ? { date } : {}),
    });
  }
  return result;
}

function firstEnglishDescription(cve: Record<string, unknown>): string | undefined {
  const descriptions = cve.descriptions;
  if (!Array.isArray(descriptions)) return undefined;
  for (const entry of descriptions) {
    if (isRecord(entry) && getString(entry, "lang") === "en") return getString(entry, "value");
  }
  return undefined;
}

function parseNvd(payload: unknown, cveId: string): VulnerabilityIntelligence["nvd"] {
  const base = { found: false, cwes: [], url: `https://nvd.nist.gov/vuln/detail/${cveId}` };
  if (!isRecord(payload) || !Array.isArray(payload.vulnerabilities)) return base;
  const first = payload.vulnerabilities[0];
  if (!isRecord(first) || !isRecord(first.cve)) return base;
  const cve = first.cve;
  const weaknesses = Array.isArray(cve.weaknesses) ? cve.weaknesses : [];
  const cwes = new Set<string>();
  for (const weakness of weaknesses) {
    if (!isRecord(weakness) || !Array.isArray(weakness.description)) continue;
    for (const description of weakness.description) {
      if (isRecord(description)) {
        const value = getString(description, "value");
        if (value?.startsWith("CWE-")) cwes.add(value);
      }
    }
  }

  let cvssScore: number | undefined;
  let cvssSeverity: string | undefined;
  if (isRecord(cve.metrics)) {
    for (const metricName of ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
      const values = cve.metrics[metricName];
      if (!Array.isArray(values) || !isRecord(values[0]) || !isRecord(values[0].cvssData)) continue;
      cvssScore = getNumber(values[0].cvssData, "baseScore");
      cvssSeverity = getString(values[0].cvssData, "baseSeverity");
      break;
    }
  }

  const description = firstEnglishDescription(cve);
  const published = getString(cve, "published");
  const lastModified = getString(cve, "lastModified");
  return {
    found: true,
    cwes: [...cwes],
    url: base.url,
    ...(description ? { description } : {}),
    ...(published ? { published } : {}),
    ...(lastModified ? { lastModified } : {}),
    ...(cvssScore !== undefined ? { cvssScore } : {}),
    ...(cvssSeverity ? { cvssSeverity } : {}),
  };
}

export async function enrichCves(
  cveIds: string[],
  options: IntelligenceOptions = {},
): Promise<VulnerabilityIntelligence[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 7000;
  const ids = [...new Set(cveIds.map((value) => value.toUpperCase()))];
  let kev = new Map<string, VulnerabilityIntelligence["kev"]>();
  let epss = new Map<string, VulnerabilityIntelligence["epss"]>();
  const sharedErrors: string[] = [];

  await Promise.all([
    fetchJson(CISA_KEV_URL, fetchImpl, timeoutMs)
      .then((payload) => {
        kev = parseKev(payload);
      })
      .catch((error: unknown) =>
        sharedErrors.push(`CISA KEV: ${error instanceof Error ? error.message : "request failed"}`),
      ),
    fetchJson(`${EPSS_URL}?cve=${encodeURIComponent(ids.join(","))}`, fetchImpl, timeoutMs)
      .then((payload) => {
        epss = parseEpss(payload);
      })
      .catch((error: unknown) =>
        sharedErrors.push(
          `FIRST EPSS: ${error instanceof Error ? error.message : "request failed"}`,
        ),
      ),
  ]);

  return await Promise.all(
    ids.map(async (cveId): Promise<VulnerabilityIntelligence> => {
      const errors = [...sharedErrors];
      let nvd: VulnerabilityIntelligence["nvd"] = {
        found: false,
        cwes: [],
        url: `https://nvd.nist.gov/vuln/detail/${cveId}`,
      };
      try {
        const payload = await fetchJson(
          `${NVD_URL}?cveId=${encodeURIComponent(cveId)}`,
          fetchImpl,
          timeoutMs,
          options.nvdApiKey ? { apiKey: options.nvdApiKey } : {},
        );
        nvd = parseNvd(payload, cveId);
      } catch (error: unknown) {
        errors.push(`NVD: ${error instanceof Error ? error.message : "request failed"}`);
      }
      return {
        cveId,
        nvd,
        kev: kev.get(cveId) ?? { listed: false },
        epss: epss.get(cveId) ?? {},
        errors,
      };
    }),
  );
}

export const intelligenceSources = [
  {
    id: "nvd",
    name: "NIST National Vulnerability Database",
    purpose: "CVE descriptions, CVSS, CWE and product applicability metadata",
    url: "https://nvd.nist.gov/developers/vulnerabilities",
    interpretation:
      "A CVE match must be verified against the deployed product, version and configuration.",
  },
  {
    id: "cisa-kev",
    name: "CISA Known Exploited Vulnerabilities",
    purpose: "Evidence that a vulnerability has been exploited in the wild",
    url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    interpretation:
      "KEV raises urgency; it does not prove the modelled asset is affected or reachable.",
  },
  {
    id: "epss",
    name: "FIRST EPSS",
    purpose: "Daily probability estimate of exploitation activity for a CVE",
    url: "https://www.first.org/epss/api",
    interpretation: "EPSS estimates likelihood and should not be used as impact or severity.",
  },
  {
    id: "atlas",
    name: "MITRE ATLAS",
    purpose: "Adversarial AI tactics, techniques, mitigations and case studies",
    url: "https://github.com/mitre-atlas/atlas-data",
    interpretation: "Technique relevance is contextual and does not prove exploitability.",
  },
  {
    id: "avid",
    name: "AI Vulnerability Database",
    purpose: "Curated evidence of failures in general-purpose AI systems",
    url: "https://docs.avidml.org/database/introduction",
    interpretation:
      "AVID records can represent failures and reports beyond conventional software vulnerabilities.",
  },
] as const;
