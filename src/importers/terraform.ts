import type { ArchitectureNode } from "../shared/schemas.js";
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
  stringValue,
} from "./utils.js";

export function isTerraformPlan(document: unknown): boolean {
  const root = asRecord(document);
  return typeof root.format_version === "string" && Boolean(root.planned_values);
}

function resources(module: Record<string, unknown>): Record<string, unknown>[] {
  const direct = Array.isArray(module.resources) ? module.resources.map(asRecord) : [];
  const children = Array.isArray(module.child_modules) ? module.child_modules.map(asRecord) : [];
  return [...direct, ...children.flatMap(resources)];
}

function resourceKind(type: string): ArchitectureNode["kind"] | undefined {
  const value = type.toLowerCase();
  if (/(openai|cognitive.*account|sagemaker.*endpoint|vertex.*endpoint|bedrock)/.test(value)) {
    return "model-api";
  }
  if (
    /(api_gateway|apigateway|api_management|application_gateway|load_balancer|\blb\b)/.test(value)
  ) {
    return "api";
  }
  if (
    /(database|db_instance|rds|sql_|cosmosdb|dynamodb|storage_|s3_bucket|blob|redis|cache)/.test(
      value,
    )
  ) {
    return "data-store";
  }
  if (
    /(lambda|function|app_service|container|ecs_|cloud_run|kubernetes|compute_instance|virtual_machine)/.test(
      value,
    )
  ) {
    return "service";
  }
  return undefined;
}

function isPublic(values: Record<string, unknown>): boolean {
  return (
    boolValue(values.publicly_accessible) === true ||
    boolValue(values.public_network_access_enabled) === true ||
    values.network_access_type === "Public" ||
    JSON.stringify(values).includes("0.0.0.0/0")
  );
}

export function importTerraformPlan(document: unknown, filename: string): ImportResult {
  const root = asRecord(document);
  const planned = asRecord(root.planned_values);
  const allResources = resources(asRecord(planned.root_module));
  const supported = allResources
    .map((resource) => ({ resource, kind: resourceKind(String(resource.type ?? "")) }))
    .filter(
      (entry): entry is { resource: Record<string, unknown>; kind: ArchitectureNode["kind"] } =>
        Boolean(entry.kind),
    )
    .slice(0, 200);
  if (supported.length === 0) {
    throw new Error(
      "The Terraform plan contains no currently supported service, API, data or AI resource types.",
    );
  }
  const nodes: ArchitectureNode[] = supported.map(({ resource, kind }, index) => {
    const address = stringValue(resource.address) ?? `resource-${index}`;
    const type = stringValue(resource.type) ?? "unknown";
    const values = asRecord(resource.values);
    const publicAccess = isPublic(values);
    return {
      id: safeId("tf", address),
      name: address.split(".").at(-1) ?? address,
      kind,
      description: `${type} imported from a Terraform plan.`,
      trustZone: stringValue(values.location) ?? stringValue(values.region) ?? "cloud",
      exposure: publicAccess ? "internet" : "internal",
      dataClassification: "internal",
      position: position(index),
      attributes: {
        ...inferredAttributes(kind),
        terraformAddress: address,
        terraformType: type,
        publicNetworkAccess: publicAccess,
      },
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence(
          "terraform-plan",
          filename,
          address,
          `${type} is present in planned values${publicAccess ? " with a public-access indicator" : ""}.`,
        ),
      ],
    };
  });
  const omitted = allResources.length - supported.length;
  const warnings = [
    "Terraform references do not necessarily represent runtime data flows; connect and confirm flows manually.",
    "Planned values may contain sensitive data. Argus processes this file locally and does not persist it server-side.",
  ];
  if (omitted > 0)
    warnings.push(
      `${omitted} unsupported or excess Terraform resources were not added to the draft.`,
    );
  return {
    format: "terraform-plan",
    formatLabel: `Terraform plan ${String(root.format_version)}`,
    model: draftModel(
      fileStem(filename) || "Terraform architecture",
      `Draft generated from ${filename}.`,
      nodes,
      [],
    ),
    warnings,
    sourceCount: allResources.length,
  };
}
