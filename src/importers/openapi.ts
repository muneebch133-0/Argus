import type { ArchitectureNode, DataFlow } from "../shared/schemas.js";
import type { ImportResult } from "./types.js";
import {
  asRecord,
  draftModel,
  inferredAttributes,
  position,
  safeId,
  sourceEvidence,
  stringValue,
} from "./utils.js";

export function isOpenApi(document: unknown): boolean {
  const root = asRecord(document);
  return typeof root.openapi === "string" || typeof root.swagger === "string";
}

function operations(root: Record<string, unknown>): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const paths = asRecord(root.paths);
  for (const rawPath of Object.values(paths)) {
    const path = asRecord(rawPath);
    for (const method of ["get", "post", "put", "patch", "delete", "options", "head", "trace"]) {
      if (path[method]) result.push(asRecord(path[method]));
    }
  }
  return result;
}

export function importOpenApi(document: unknown, filename: string): ImportResult {
  const root = asRecord(document);
  const info = asRecord(root.info);
  const title = stringValue(info.title) ?? "Imported API";
  const version = stringValue(root.openapi) ?? stringValue(root.swagger) ?? "unknown";
  const allOperations = operations(root);
  const globalSecurity = Array.isArray(root.security) && root.security.length > 0;
  const securedOperations = allOperations.filter(
    (operation) =>
      (Array.isArray(operation.security) && operation.security.length > 0) ||
      (operation.security === undefined && globalSecurity),
  ).length;
  const servers = Array.isArray(root.servers) ? root.servers.map(asRecord) : [];
  const serverUrls = servers
    .map((server) => stringValue(server.url))
    .filter((value): value is string => Boolean(value));
  const encrypted = serverUrls.length > 0 && serverUrls.every((url) => url.startsWith("https://"));
  const authenticated = allOperations.length > 0 && securedOperations === allOperations.length;
  const actorId = safeId("actor", `${title}-caller`);
  const apiId = safeId("api", title);
  const nodes: ArchitectureNode[] = [
    {
      id: actorId,
      name: "External API caller",
      kind: "actor",
      description:
        "Caller inferred from the API contract; identity and trust level require review.",
      trustZone: "internet",
      exposure: "internet",
      dataClassification: "internal",
      position: position(0),
      attributes: {},
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence(
          "openapi",
          filename,
          "paths",
          `${allOperations.length} API operations declared.`,
        ),
      ],
    },
    {
      id: apiId,
      name: title,
      kind: "api",
      description: stringValue(info.description) ?? `API imported from OpenAPI ${version}.`,
      trustZone: "application",
      exposure: "internet",
      dataClassification: "internal",
      position: position(1),
      attributes: {
        ...inferredAttributes("api"),
        operationCount: allOperations.length,
        documentedVersion: stringValue(info.version) ?? "unknown",
      },
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence(
          "openapi",
          filename,
          "info",
          `OpenAPI contract ${version} identifies this API.`,
        ),
      ],
    },
  ];
  const flow: DataFlow = {
    id: safeId("flow", `${actorId}-${apiId}`),
    source: actorId,
    target: apiId,
    label: `${allOperations.length} documented operations`,
    protocol: encrypted ? "HTTPS" : "HTTP or unspecified",
    authenticated,
    encrypted,
    carriesSensitiveData: false,
    untrustedContent: true,
    crossesTrustBoundary: true,
    reviewStatus: "needs-review",
    evidence: [
      sourceEvidence(
        "openapi",
        filename,
        "security/servers/paths",
        `${securedOperations}/${allOperations.length} operations have an applicable security declaration; ${serverUrls.length} server URLs were observed.`,
      ),
    ],
  };
  const warnings: string[] = [];
  if (!authenticated)
    warnings.push("Not every API operation has an applicable OpenAPI security declaration.");
  if (serverUrls.length === 0)
    warnings.push("No OpenAPI server URL was available to evidence transport encryption.");
  if (!encrypted && serverUrls.length > 0)
    warnings.push("At least one declared server URL is not HTTPS.");
  warnings.push(
    "OpenAPI describes an interface, not runtime authorisation, rate limits or logging; confirm those controls.",
  );

  return {
    format: "openapi",
    formatLabel: `OpenAPI ${version}`,
    model: draftModel(title, `Draft generated from ${filename}.`, nodes, [flow], "standard"),
    warnings,
    sourceCount: allOperations.length,
  };
}
