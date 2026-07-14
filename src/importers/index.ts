import { parseAllDocuments } from "yaml";
import { systemModelSchema } from "../shared/schemas.js";
import { importDockerCompose, isDockerCompose } from "./compose.js";
import { importKubernetes, isKubernetes } from "./kubernetes.js";
import { importMcpConfig, isMcpConfig } from "./mcp.js";
import { importOpenApi, isOpenApi } from "./openapi.js";
import { importTerraformPlan, isTerraformPlan } from "./terraform.js";
import type { ImportResult } from "./types.js";

export type { ImportFormat, ImportResult } from "./types.js";

export const MAX_IMPORT_BYTES = 2_000_000;

function checked(result: ImportResult): ImportResult {
  const model = systemModelSchema.safeParse(result.model);
  if (!model.success) {
    const firstIssue = model.error.issues[0];
    const location = firstIssue?.path.join(".") || "model";
    throw new Error(
      `The generated architecture is invalid at ${location}: ${firstIssue?.message ?? "schema validation failed"}`,
    );
  }
  return { ...result, model: model.data };
}

function parsedDocuments(filename: string, text: string): unknown[] {
  try {
    if (filename.toLowerCase().endsWith(".json")) return [JSON.parse(text)];
    const documents = parseAllDocuments(text).map((document) => {
      if (document.errors.length > 0)
        throw new Error(document.errors[0]?.message ?? "Invalid YAML");
      return document.toJS({ maxAliasCount: 100 });
    });
    return documents.filter((document) => document !== null && document !== undefined);
  } catch (error: unknown) {
    throw new Error(
      `Could not parse ${filename} as JSON or YAML: ${error instanceof Error ? error.message : "invalid input"}`,
    );
  }
}

export function importArchitecture(filename: string, text: string): ImportResult {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new Error("Architecture imports are limited to 2 MB.");
  }
  const documents = parsedDocuments(filename, text);
  if (documents.length === 0) throw new Error("The imported file is empty.");
  if (documents.length === 1) {
    const native = systemModelSchema.safeParse(documents[0]);
    if (native.success) {
      return {
        format: "argus",
        formatLabel: "Argus model",
        model: native.data,
        warnings: [],
        sourceCount: native.data.nodes.length + native.data.flows.length,
      };
    }
    const first = documents[0];
    if (isOpenApi(first)) return checked(importOpenApi(first, filename));
    if (isDockerCompose(first)) return checked(importDockerCompose(first, filename));
    if (isTerraformPlan(first)) return checked(importTerraformPlan(first, filename));
    if (isMcpConfig(first)) return checked(importMcpConfig(first, filename));
  }
  if (isKubernetes(documents)) return checked(importKubernetes(documents, filename));
  throw new Error(
    "Unsupported architecture file. Use an Argus model, OpenAPI, Docker Compose, Kubernetes manifest, Terraform plan JSON or MCP configuration.",
  );
}
