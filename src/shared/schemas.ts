import { z } from "zod";
import { CONFIDENCE_LEVELS, NODE_KINDS, SEVERITIES, SYSTEM_KINDS } from "./constants.js";

export const attributeValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(200)).max(100),
]);

export const architectureNodeSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(120),
  kind: z.enum(NODE_KINDS),
  description: z.string().max(1000).default(""),
  trustZone: z.string().min(1).max(80).default("application"),
  exposure: z.enum(["internal", "partner", "internet"]).default("internal"),
  dataClassification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  attributes: z.record(z.string(), attributeValueSchema).default({}),
});

export const dataFlowSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  source: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  label: z.string().max(120).default("data flow"),
  protocol: z.string().max(40).default("HTTPS"),
  authenticated: z.boolean().default(true),
  encrypted: z.boolean().default(true),
  carriesSensitiveData: z.boolean().default(false),
  untrustedContent: z.boolean().default(false),
  crossesTrustBoundary: z.boolean().default(false),
});

export const systemModelSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    name: z.string().min(1).max(120),
    description: z.string().max(2000).default(""),
    systemKind: z.enum(SYSTEM_KINDS).default("auto"),
    businessCriticality: z.enum(["low", "medium", "high", "mission-critical"]).default("high"),
    nodes: z.array(architectureNodeSchema).min(1).max(250),
    flows: z.array(dataFlowSchema).max(750),
  })
  .superRefine((model, context) => {
    const ids = new Set(model.nodes.map((node) => node.id));
    if (ids.size !== model.nodes.length) {
      context.addIssue({ code: "custom", message: "Node IDs must be unique", path: ["nodes"] });
    }
    const flowIds = new Set<string>();
    for (const [index, flow] of model.flows.entries()) {
      if (!ids.has(flow.source) || !ids.has(flow.target)) {
        context.addIssue({
          code: "custom",
          message: "Flow source and target must reference existing nodes",
          path: ["flows", index],
        });
      }
      if (flowIds.has(flow.id)) {
        context.addIssue({
          code: "custom",
          message: "Flow IDs must be unique",
          path: ["flows", index],
        });
      }
      flowIds.add(flow.id);
    }
  });

export const analysisOptionsSchema = z.object({
  liveVulnerabilityEnrichment: z.boolean().default(false),
  includeInformational: z.boolean().default(false),
});

export const analysisRequestSchema = z.object({
  model: systemModelSchema,
  options: analysisOptionsSchema.default({
    liveVulnerabilityEnrichment: false,
    includeInformational: false,
  }),
});

export const cveRequestSchema = z.object({
  cveIds: z
    .array(z.string().regex(/^CVE-\d{4}-\d{4,}$/i))
    .min(1)
    .max(25)
    .transform((values) => [...new Set(values.map((value) => value.toUpperCase()))]),
});

export const frameworkRefSchema = z.object({
  framework: z.string(),
  id: z.string(),
  name: z.string(),
  version: z.string(),
  url: z.string().url(),
  rationale: z.string(),
});

export const evidenceSchema = z.object({
  type: z.enum(["framework", "case-study", "vulnerability", "inference"]),
  title: z.string(),
  url: z.string().url().optional(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  notes: z.string(),
});

export const controlSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  type: z.enum(["prevent", "detect", "respond", "govern"]),
  priority: z.enum(["mandatory", "recommended"]),
  implementation: z.array(z.string()),
  verification: z.array(z.string()),
  references: z.array(frameworkRefSchema),
});

export const threatSchema = z.object({
  id: z.string(),
  title: z.string(),
  scenario: z.string(),
  category: z.string(),
  findingType: z.enum([
    "design-threat",
    "ai-threat",
    "potential-vulnerability",
    "confirmed-vulnerability",
  ]),
  severity: z.enum(SEVERITIES),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  riskScore: z.number().min(0).max(100),
  confidence: z.enum(CONFIDENCE_LEVELS),
  affectedNodeIds: z.array(z.string()),
  affectedFlowIds: z.array(z.string()),
  frameworks: z.array(frameworkRefSchema),
  evidence: z.array(evidenceSchema),
  attackPath: z.array(z.string()),
  controlIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export const analysisResultSchema = z.object({
  analysisId: z.string(),
  generatedAt: z.string().datetime(),
  engineVersion: z.string(),
  mode: z.enum(["standard", "ai", "agentic"]),
  summary: z.object({
    total: z.number().int(),
    critical: z.number().int(),
    high: z.number().int(),
    medium: z.number().int(),
    low: z.number().int(),
    controlCount: z.number().int(),
    highestRiskScore: z.number(),
  }),
  threats: z.array(threatSchema),
  controls: z.array(controlSchema),
  frameworkCoverage: z.array(
    z.object({
      framework: z.string(),
      version: z.string(),
      findingCount: z.number().int(),
    }),
  ),
  warnings: z.array(z.string()),
});

export type ArchitectureNode = z.infer<typeof architectureNodeSchema>;
export type DataFlow = z.infer<typeof dataFlowSchema>;
export type SystemModel = z.infer<typeof systemModelSchema>;
export type AnalysisOptions = z.infer<typeof analysisOptionsSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type FrameworkRef = z.infer<typeof frameworkRefSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Control = z.infer<typeof controlSchema>;
export type Threat = z.infer<typeof threatSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type Severity = (typeof SEVERITIES)[number];
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];
