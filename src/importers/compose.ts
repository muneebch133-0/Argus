import type { ArchitectureNode, DataFlow } from "../shared/schemas.js";
import type { ImportResult } from "./types.js";
import {
  asRecord,
  boolValue,
  draftModel,
  fileStem,
  inferredAttributes,
  position,
  safeId,
  sourceEvidence,
  stringArray,
  stringValue,
} from "./utils.js";

export function isDockerCompose(document: unknown): boolean {
  return Object.keys(asRecord(asRecord(document).services)).length > 0;
}

function serviceKind(name: string, service: Record<string, unknown>): ArchitectureNode["kind"] {
  const image = stringValue(service.image) ?? "";
  const signature = `${name} ${image}`.toLowerCase();
  if (/(postgres|mysql|mariadb|mongo|redis|cassandra|database|\bdb\b)/.test(signature)) {
    return "data-store";
  }
  if (/(ollama|vllm|model|inference|openai)/.test(signature)) return "model-api";
  if (/(agent|orchestrator)/.test(signature)) return "agent";
  return "service";
}

function dependencies(service: Record<string, unknown>): string[] {
  if (Array.isArray(service.depends_on)) return stringArray(service.depends_on);
  return Object.keys(asRecord(service.depends_on));
}

export function importDockerCompose(document: unknown, filename: string): ImportResult {
  const services = asRecord(asRecord(document).services);
  const names = Object.keys(services);
  const idByName = new Map<string, string>();
  const nodes: ArchitectureNode[] = names.map((name, index) => {
    const service = asRecord(services[name]);
    const kind = serviceKind(name, service);
    const id = safeId("compose", name);
    idByName.set(name, id);
    const ports = Array.isArray(service.ports) ? service.ports : [];
    const published = ports.length > 0;
    const image = stringValue(service.image);
    const privileged = boolValue(service.privileged) ?? false;
    return {
      id,
      name,
      kind,
      description: image ? `Container service using ${image}.` : "Container service built locally.",
      trustZone: "container-network",
      exposure: published ? "internet" : "internal",
      dataClassification: "internal",
      position: position(index),
      attributes: {
        ...inferredAttributes(kind),
        ...(image ? { image } : {}),
        publishedPorts: ports.map((port) =>
          typeof port === "string" || typeof port === "number" ? String(port) : "structured-port",
        ),
        privileged,
        readOnlyFilesystem: boolValue(service.read_only) ?? false,
      },
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence(
          "docker-compose",
          filename,
          `services.${name}`,
          `Service declared${image ? ` with image ${image}` : ""}${published ? " and published ports" : ""}.`,
        ),
      ],
    };
  });

  const warnings: string[] = [];
  const flows: DataFlow[] = [];
  for (const sourceName of names) {
    const service = asRecord(services[sourceName]);
    for (const targetName of dependencies(service)) {
      const source = idByName.get(sourceName);
      const target = idByName.get(targetName);
      if (!source || !target) {
        warnings.push(`Dependency ${sourceName} → ${targetName} could not be resolved.`);
        continue;
      }
      flows.push({
        id: safeId("flow", `${sourceName}-${targetName}`),
        source,
        target,
        label: "declared dependency",
        protocol: "unspecified",
        authenticated: false,
        encrypted: false,
        carriesSensitiveData: false,
        untrustedContent: false,
        crossesTrustBoundary: false,
        reviewStatus: "needs-review",
        evidence: [
          sourceEvidence(
            "docker-compose",
            filename,
            `services.${sourceName}.depends_on`,
            `Compose declares a startup dependency on ${targetName}; actual data flow requires confirmation.`,
          ),
        ],
      });
    }
  }
  warnings.push(
    "Compose dependencies do not prove runtime data flow, authentication or encryption; review every generated edge.",
  );
  return {
    format: "docker-compose",
    formatLabel: "Docker Compose",
    model: draftModel(
      fileStem(filename) || "Compose application",
      `Draft generated from ${filename}.`,
      nodes,
      flows,
    ),
    warnings,
    sourceCount: names.length,
  };
}
