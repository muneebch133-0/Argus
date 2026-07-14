import type { SystemModel } from "../shared/schemas.js";

export type ImportFormat =
  | "argus"
  | "openapi"
  | "docker-compose"
  | "kubernetes"
  | "terraform-plan"
  | "mcp-config";

export interface ImportResult {
  format: ImportFormat;
  formatLabel: string;
  model: SystemModel;
  warnings: string[];
  sourceCount: number;
}
