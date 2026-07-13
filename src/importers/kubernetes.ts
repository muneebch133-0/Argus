import type { ArchitectureNode, DataFlow } from "../shared/schemas.js";
import type { ImportResult } from "./types.js";
import {
  asRecord,
  boolValue,
  draftModel,
  fileStem,
  inferredAttributes,
  isRecord,
  position,
  safeId,
  sourceEvidence,
  stringValue,
} from "./utils.js";

const workloadKinds = new Set(["Deployment", "StatefulSet", "DaemonSet", "Pod", "Job", "CronJob"]);

function flattenDocuments(documents: unknown[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  for (const document of documents) {
    const record = asRecord(document);
    if (record.kind === "List" && Array.isArray(record.items)) {
      result.push(...record.items.filter(isRecord));
    } else if (Object.keys(record).length > 0) {
      result.push(record);
    }
  }
  return result;
}

export function isKubernetes(documents: unknown[]): boolean {
  return flattenDocuments(documents).some(
    (document) => typeof document.apiVersion === "string" && typeof document.kind === "string",
  );
}

function metadata(document: Record<string, unknown>): Record<string, unknown> {
  return asRecord(document.metadata);
}

function objectName(document: Record<string, unknown>): string {
  return stringValue(metadata(document).name) ?? "unnamed";
}

function namespace(document: Record<string, unknown>): string {
  return stringValue(metadata(document).namespace) ?? "default";
}

function podSpec(document: Record<string, unknown>): Record<string, unknown> {
  const kind = stringValue(document.kind);
  const spec = asRecord(document.spec);
  if (kind === "Pod") return spec;
  if (kind === "CronJob") {
    const jobSpec = asRecord(asRecord(spec.jobTemplate).spec);
    return asRecord(asRecord(jobSpec.template).spec);
  }
  return asRecord(asRecord(spec.template).spec);
}

function labels(document: Record<string, unknown>): Record<string, unknown> {
  const direct = asRecord(metadata(document).labels);
  const template = asRecord(asRecord(asRecord(document.spec).template).metadata);
  return Object.keys(direct).length > 0 ? direct : asRecord(template.labels);
}

function selectorMatches(
  selector: Record<string, unknown>,
  candidate: Record<string, unknown>,
): boolean {
  const entries = Object.entries(selector);
  return entries.length > 0 && entries.every(([key, value]) => candidate[key] === value);
}

function aiKind(name: string, images: string[]): ArchitectureNode["kind"] {
  const signature = `${name} ${images.join(" ")}`.toLowerCase();
  if (/(agent|orchestrator)/.test(signature)) return "agent";
  if (/(ollama|vllm|model-server|inference|openai)/.test(signature)) return "model-api";
  return "service";
}

export function importKubernetes(rawDocuments: unknown[], filename: string): ImportResult {
  const documents = flattenDocuments(rawDocuments);
  const warnings: string[] = [];
  const nodes: ArchitectureNode[] = [];
  const flows: DataFlow[] = [];
  const workloadIds = new Map<string, string>();
  const workloadLabels = new Map<string, Record<string, unknown>>();
  const serviceIds = new Map<string, string>();

  for (const document of documents.filter((item) => workloadKinds.has(String(item.kind)))) {
    const name = objectName(document);
    const ns = namespace(document);
    const key = `${ns}/${name}`;
    const spec = podSpec(document);
    const containers = Array.isArray(spec.containers) ? spec.containers.map(asRecord) : [];
    const images = containers
      .map((container) => stringValue(container.image))
      .filter((value): value is string => Boolean(value));
    const securityContexts = containers.map((container) => asRecord(container.securityContext));
    const kind = aiKind(name, images);
    const id = safeId("k8s-workload", key);
    workloadIds.set(key, id);
    workloadLabels.set(key, labels(document));
    const podSecurity = asRecord(spec.securityContext);
    nodes.push({
      id,
      name,
      kind,
      description: `${String(document.kind)} in namespace ${ns}.`,
      trustZone: `kubernetes:${ns}`,
      exposure: "internal",
      dataClassification: "internal",
      position: position(nodes.length),
      attributes: {
        ...inferredAttributes(kind),
        kubernetesKind: String(document.kind),
        namespace: ns,
        images,
        serviceAccountName: stringValue(spec.serviceAccountName) ?? "default",
        privileged: securityContexts.some((context) => boolValue(context.privileged) === true),
        runAsNonRoot:
          boolValue(podSecurity.runAsNonRoot) === true ||
          (securityContexts.length > 0 &&
            securityContexts.every((context) => boolValue(context.runAsNonRoot) === true)),
        readOnlyRootFilesystem:
          securityContexts.length > 0 &&
          securityContexts.every((context) => boolValue(context.readOnlyRootFilesystem) === true),
      },
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence(
          "kubernetes",
          filename,
          `${String(document.kind)}/${ns}/${name}`,
          `Workload declares ${containers.length} container(s).`,
        ),
      ],
    });
  }

  for (const document of documents.filter((item) => item.kind === "Service")) {
    const name = objectName(document);
    const ns = namespace(document);
    const key = `${ns}/${name}`;
    const spec = asRecord(document.spec);
    const type = stringValue(spec.type) ?? "ClusterIP";
    const exposed = type === "LoadBalancer" || type === "NodePort";
    const id = safeId("k8s-service", key);
    serviceIds.set(key, id);
    nodes.push({
      id,
      name,
      kind: exposed ? "api" : "service",
      description: `Kubernetes Service (${type}) in namespace ${ns}.`,
      trustZone: `kubernetes:${ns}`,
      exposure: exposed ? "internet" : "internal",
      dataClassification: "internal",
      position: position(nodes.length),
      attributes: { ...inferredAttributes(exposed ? "api" : "service"), serviceType: type },
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence("kubernetes", filename, `Service/${ns}/${name}`, `Service type is ${type}.`),
      ],
    });
    const selector = asRecord(spec.selector);
    let matched = 0;
    for (const [workloadKey, candidateLabels] of workloadLabels) {
      if (!workloadKey.startsWith(`${ns}/`) || !selectorMatches(selector, candidateLabels))
        continue;
      const target = workloadIds.get(workloadKey);
      if (!target) continue;
      matched += 1;
      flows.push({
        id: safeId("flow", `${key}-${workloadKey}`),
        source: id,
        target,
        label: "service selector",
        protocol: "unspecified",
        authenticated: false,
        encrypted: false,
        carriesSensitiveData: false,
        untrustedContent: true,
        crossesTrustBoundary: false,
        reviewStatus: "needs-review",
        evidence: [
          sourceEvidence(
            "kubernetes",
            filename,
            `Service/${ns}/${name}.spec.selector`,
            `Service selector matches workload ${workloadKey}.`,
          ),
        ],
      });
    }
    if (matched === 0) warnings.push(`Service ${key} did not match an imported workload selector.`);
  }

  let actorId: string | undefined;
  for (const document of documents.filter((item) => item.kind === "Ingress")) {
    const name = objectName(document);
    const ns = namespace(document);
    const spec = asRecord(document.spec);
    const hasTls = Array.isArray(spec.tls) && spec.tls.length > 0;
    actorId ??= safeId("actor", "kubernetes-ingress-client");
    if (!nodes.some((node) => node.id === actorId)) {
      nodes.push({
        id: actorId,
        name: "Internet client",
        kind: "actor",
        description: "External caller inferred from a Kubernetes Ingress.",
        trustZone: "internet",
        exposure: "internet",
        dataClassification: "internal",
        position: position(nodes.length),
        attributes: {},
        reviewStatus: "needs-review",
        evidence: [
          sourceEvidence(
            "kubernetes",
            filename,
            `Ingress/${ns}/${name}`,
            "Ingress exposes an application route.",
          ),
        ],
      });
    }
    const rules = Array.isArray(spec.rules) ? spec.rules.map(asRecord) : [];
    for (const rule of rules) {
      const paths = Array.isArray(asRecord(rule.http).paths)
        ? (asRecord(rule.http).paths as unknown[]).map(asRecord)
        : [];
      for (const path of paths) {
        const backendService = asRecord(asRecord(path.backend).service);
        const serviceName = stringValue(backendService.name);
        const target = serviceName ? serviceIds.get(`${ns}/${serviceName}`) : undefined;
        if (!target || !serviceName) {
          warnings.push(
            `Ingress ${ns}/${name} has a backend that was not resolved to an imported Service.`,
          );
          continue;
        }
        flows.push({
          id: safeId("flow", `ingress-${ns}-${name}-${serviceName}-${String(path.path ?? "/")}`),
          source: actorId,
          target,
          label: stringValue(path.path) ?? "ingress route",
          protocol: hasTls ? "HTTPS" : "HTTP",
          authenticated: false,
          encrypted: hasTls,
          carriesSensitiveData: false,
          untrustedContent: true,
          crossesTrustBoundary: true,
          reviewStatus: "needs-review",
          evidence: [
            sourceEvidence(
              "kubernetes",
              filename,
              `Ingress/${ns}/${name}.spec.rules`,
              `Ingress route targets Service ${serviceName}; TLS declaration is ${hasTls ? "present" : "not present"}.`,
            ),
          ],
        });
      }
    }
  }

  if (nodes.length === 0)
    throw new Error("No supported Kubernetes workloads, Services or Ingress objects were found.");
  warnings.push(
    "Kubernetes manifests show declared configuration, not effective network policy, identity or runtime state.",
  );
  return {
    format: "kubernetes",
    formatLabel: "Kubernetes manifests",
    model: draftModel(
      fileStem(filename) || "Kubernetes workload",
      `Draft generated from ${filename}.`,
      nodes,
      flows,
    ),
    warnings,
    sourceCount: documents.length,
  };
}
