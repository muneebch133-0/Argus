import { randomUUID } from "node:crypto";
import type { AnalysisResult, SystemModel } from "../shared/schemas.js";
import { selectControls } from "./controls.js";
import { runThreatRules } from "./rules.js";

export const ENGINE_VERSION = "0.1.0";

export function analyzeSystem(model: SystemModel): AnalysisResult {
  const { mode, threats } = runThreatRules(model);
  const controls = selectControls(threats.flatMap((threat) => threat.controlIds));
  const frameworkCounts = new Map<string, { version: string; count: number }>();
  for (const threat of threats) {
    for (const reference of threat.frameworks) {
      const current = frameworkCounts.get(reference.framework) ?? {
        version: reference.version,
        count: 0,
      };
      current.count += 1;
      frameworkCounts.set(reference.framework, current);
    }
  }

  const highestRiskScore = threats[0]?.riskScore ?? 0;
  const warnings = [
    "Argus identifies design threats from supplied architecture evidence; findings require human validation.",
    "Framework mappings show relevant relationships, not proof that every technique is feasible in the deployed environment.",
    "A CVE association remains potential until product, version, configuration and reachability are verified.",
  ];

  if (
    model.nodes.some((node) => node.kind === "agent") &&
    !model.nodes.some((node) => node.kind === "human-approval")
  ) {
    warnings.push("No human approval component is modelled for this agentic system.");
  }

  return {
    analysisId: randomUUID(),
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    mode,
    summary: {
      total: threats.length,
      critical: threats.filter((threat) => threat.severity === "critical").length,
      high: threats.filter((threat) => threat.severity === "high").length,
      medium: threats.filter((threat) => threat.severity === "medium").length,
      low: threats.filter((threat) => threat.severity === "low").length,
      controlCount: controls.length,
      highestRiskScore,
    },
    threats,
    controls,
    frameworkCoverage: [...frameworkCounts.entries()]
      .map(([framework, value]) => ({
        framework,
        version: value.version,
        findingCount: value.count,
      }))
      .sort((left, right) => right.findingCount - left.findingCount),
    warnings,
  };
}
