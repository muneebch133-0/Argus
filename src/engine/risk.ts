import type { ArchitectureNode, Severity, SystemModel } from "../shared/schemas.js";

export interface RiskInput {
  likelihood: number;
  impact: number;
  affectedNodes: ArchitectureNode[];
  model: SystemModel;
}

export function calculateRisk(input: RiskInput): {
  likelihood: number;
  impact: number;
  riskScore: number;
  severity: Severity;
} {
  let likelihood = input.likelihood;
  let impact = input.impact;

  if (input.affectedNodes.some((node) => node.exposure === "internet")) {
    likelihood += 1;
  }
  if (input.affectedNodes.some((node) => node.dataClassification === "restricted")) {
    impact += 1;
  }
  if (input.model.businessCriticality === "mission-critical") {
    impact += 1;
  }

  likelihood = Math.max(1, Math.min(5, likelihood));
  impact = Math.max(1, Math.min(5, impact));
  const riskScore = Math.round((likelihood * impact * 100) / 25);
  const severity: Severity =
    riskScore >= 80 ? "critical" : riskScore >= 56 ? "high" : riskScore >= 28 ? "medium" : "low";

  return { likelihood, impact, riskScore, severity };
}
