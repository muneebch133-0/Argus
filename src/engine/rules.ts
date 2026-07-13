import { createHash } from "node:crypto";
import { AGENTIC_NODE_KINDS, AI_NODE_KINDS } from "../shared/constants.js";
import type {
  ArchitectureNode,
  Confidence,
  Evidence,
  FrameworkRef,
  SystemModel,
  Threat,
} from "../shared/schemas.js";
import {
  atlasRef,
  attackRef,
  maestroRef,
  nistAmlRef,
  owaspAgenticRef,
  owaspLlmRef,
  sourceUrls,
  strideRef,
} from "./frameworks.js";
import { calculateRisk } from "./risk.js";

export type AnalysisMode = "standard" | "ai" | "agentic";

interface ThreatDraft {
  ruleId: string;
  entityKey: string;
  title: string;
  scenario: string;
  category: string;
  findingType: Threat["findingType"];
  likelihood: number;
  impact: number;
  confidence: Confidence;
  affectedNodeIds: string[];
  affectedFlowIds: string[];
  frameworks: FrameworkRef[];
  evidence?: Evidence[];
  attackPath: string[];
  controlIds: string[];
  assumptions?: string[];
}

const executableKinds = new Set<ArchitectureNode["kind"]>([
  "application",
  "api",
  "service",
  "agent",
  "agent-orchestrator",
  "tool",
  "mcp-server",
]);

const aiInputKinds = new Set<ArchitectureNode["kind"]>([
  "foundation-model",
  "model-api",
  "agent",
  "agent-orchestrator",
  "rag-pipeline",
]);

function boolAttr(node: ArchitectureNode, key: string): boolean {
  return node.attributes[key] === true;
}

function stringValues(node: ArchitectureNode, key: string): string[] {
  const value = node.attributes[key];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function evidence(title: string, notes: string, url?: string): Evidence {
  return {
    type: "framework",
    title,
    confidence: "high",
    notes,
    ...(url ? { url } : {}),
  };
}

function makeThreat(model: SystemModel, draft: ThreatDraft): Threat {
  const affectedNodes = model.nodes.filter((node) => draft.affectedNodeIds.includes(node.id));
  const risk = calculateRisk({
    likelihood: draft.likelihood,
    impact: draft.impact,
    affectedNodes,
    model,
  });
  const digest = createHash("sha256")
    .update(`${draft.ruleId}:${draft.entityKey}`)
    .digest("hex")
    .slice(0, 10);

  return {
    id: `${draft.ruleId}-${digest}`,
    title: draft.title,
    scenario: draft.scenario,
    category: draft.category,
    findingType: draft.findingType,
    severity: risk.severity,
    likelihood: risk.likelihood,
    impact: risk.impact,
    riskScore: risk.riskScore,
    confidence: draft.confidence,
    affectedNodeIds: draft.affectedNodeIds,
    affectedFlowIds: draft.affectedFlowIds,
    frameworks: draft.frameworks,
    evidence: draft.evidence ?? [],
    attackPath: draft.attackPath,
    controlIds: draft.controlIds,
    assumptions: draft.assumptions ?? [],
  };
}

function connectedNode(model: SystemModel, id: string): ArchitectureNode | undefined {
  return model.nodes.find((node) => node.id === id);
}

function hasKind(model: SystemModel, kind: ArchitectureNode["kind"]): boolean {
  return model.nodes.some((node) => node.kind === kind);
}

function pathHasHumanApproval(model: SystemModel, agentId: string, targetId: string): boolean {
  const approvalIds = new Set(
    model.nodes.filter((node) => node.kind === "human-approval").map((node) => node.id),
  );
  if (approvalIds.size === 0) return false;
  const outgoing = new Map<string, string[]>();
  for (const flow of model.flows) {
    outgoing.set(flow.source, [...(outgoing.get(flow.source) ?? []), flow.target]);
  }
  for (const approvalId of approvalIds) {
    if (
      (outgoing.get(agentId) ?? []).includes(approvalId) &&
      (outgoing.get(approvalId) ?? []).includes(targetId)
    ) {
      return true;
    }
  }
  return false;
}

function addTransportRules(model: SystemModel, drafts: ThreatDraft[]): void {
  for (const flow of model.flows) {
    const source = connectedNode(model, flow.source);
    const target = connectedNode(model, flow.target);
    if (!source || !target) continue;

    if (!flow.authenticated && (flow.crossesTrustBoundary || source.exposure !== target.exposure)) {
      drafts.push({
        ruleId: "ARGUS-STRIDE-S001",
        entityKey: flow.id,
        title: `Unauthenticated flow to ${target.name}`,
        scenario: `An attacker can impersonate ${source.name} when sending ${flow.label} to ${target.name} because the flow crosses a trust boundary without authenticated identity.`,
        category: "Spoofing",
        findingType: "design-threat",
        likelihood: 4,
        impact: 4,
        confidence: "high",
        affectedNodeIds: [source.id, target.id],
        affectedFlowIds: [flow.id],
        frameworks: [
          strideRef("Spoofing", "The receiver cannot establish the identity of the sender."),
          attackRef(
            "T1078",
            "Valid Accounts",
            "Weak identity enforcement can enable access using assumed or compromised identities.",
          ),
        ],
        evidence: [
          evidence(
            "Architecture evidence",
            "The model marks this boundary-crossing flow as unauthenticated.",
          ),
        ],
        attackPath: [source.name, "Impersonated request", target.name],
        controlIds: ["ARGUS-IAM-001", "ARGUS-APP-001", "ARGUS-OPS-001"],
      });
    }

    if (!flow.encrypted) {
      drafts.push({
        ruleId: "ARGUS-STRIDE-ID001",
        entityKey: flow.id,
        title: `Unprotected data flow between ${source.name} and ${target.name}`,
        scenario: `A network-positioned attacker can observe or modify ${flow.label} because authenticated encryption is not evidenced for the flow.`,
        category: "Information Disclosure / Tampering",
        findingType: "design-threat",
        likelihood: flow.crossesTrustBoundary ? 4 : 3,
        impact: flow.carriesSensitiveData ? 5 : 3,
        confidence: "high",
        affectedNodeIds: [source.id, target.id],
        affectedFlowIds: [flow.id],
        frameworks: [
          strideRef("Information Disclosure", "Plaintext data may be observed in transit."),
          strideRef("Tampering", "An unauthenticated channel may permit undetected modification."),
          attackRef(
            "T1040",
            "Network Sniffing",
            "Unprotected network traffic can expose information to an adversary.",
          ),
        ],
        evidence: [
          evidence("Architecture evidence", "The model marks this data flow as unencrypted."),
        ],
        attackPath: [source.name, "Intercepted or altered traffic", target.name],
        controlIds: ["ARGUS-DATA-001", "ARGUS-OPS-002"],
      });
    }
  }
}

function addComponentRules(model: SystemModel, drafts: ThreatDraft[]): void {
  for (const node of model.nodes) {
    if (
      executableKinds.has(node.kind) &&
      node.exposure === "internet" &&
      !boolAttr(node, "rateLimited")
    ) {
      drafts.push({
        ruleId: "ARGUS-STRIDE-D001",
        entityKey: node.id,
        title: `${node.name} has no evidenced resource controls`,
        scenario: `An unauthenticated or low-cost attacker can exhaust ${node.name} or its dependencies because rate, concurrency and resource budgets are not evidenced.`,
        category: "Denial of Service",
        findingType: "design-threat",
        likelihood: 4,
        impact: 3,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          strideRef(
            "Denial of Service",
            "The internet-exposed component has no modelled resource protection.",
          ),
          attackRef(
            "T1499",
            "Endpoint Denial of Service",
            "An adversary may exhaust an exposed service endpoint.",
          ),
        ],
        attackPath: ["Internet attacker", "High-volume or high-cost requests", node.name],
        controlIds: ["ARGUS-APP-002", "ARGUS-OPS-002"],
        assumptions: [
          "Absence of a modelled control is treated as not evidenced, not proof that the control is absent.",
        ],
      });
    }

    if (executableKinds.has(node.kind) && !boolAttr(node, "auditLogging")) {
      drafts.push({
        ruleId: "ARGUS-STRIDE-R001",
        entityKey: node.id,
        title: `Actions through ${node.name} may not be attributable`,
        scenario: `A user, workload or agent can dispute actions performed through ${node.name} because actor, request and outcome audit evidence is not modelled.`,
        category: "Repudiation",
        findingType: "design-threat",
        likelihood: 3,
        impact: boolAttr(node, "highImpact") ? 5 : 3,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          strideRef("Repudiation", "Complete and protected audit records are not evidenced."),
        ],
        attackPath: ["Actor or workload", node.name, "Action without sufficient evidence"],
        controlIds: ["ARGUS-OPS-001", "ARGUS-OPS-002"],
        assumptions: ["Audit coverage requires verification against actual telemetry."],
      });
    }

    if (
      executableKinds.has(node.kind) &&
      node.exposure !== "internal" &&
      !boolAttr(node, "inputValidation")
    ) {
      drafts.push({
        ruleId: "ARGUS-STRIDE-T001",
        entityKey: node.id,
        title: `Untrusted input reaches ${node.name} without evidenced validation`,
        scenario: `An external caller can submit malformed or malicious input that changes data or execution in ${node.name}.`,
        category: "Tampering",
        findingType: "design-threat",
        likelihood: 4,
        impact: 4,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          strideRef("Tampering", "Unvalidated input can modify system state or interpretation."),
          attackRef(
            "T1190",
            "Exploit Public-Facing Application",
            "Input-handling weaknesses can expose internet-facing application functionality.",
          ),
        ],
        attackPath: ["External caller", "Crafted input", node.name],
        controlIds: ["ARGUS-APP-001", "ARGUS-OPS-002"],
        assumptions: [
          "The rule identifies missing evidence; it does not assert a specific exploitable code defect.",
        ],
      });
    }

    if (
      (node.kind === "data-store" || node.kind === "vector-store" || node.kind === "memory") &&
      node.dataClassification !== "public" &&
      !boolAttr(node, "encryptedAtRest")
    ) {
      drafts.push({
        ruleId: "ARGUS-STRIDE-ID002",
        entityKey: node.id,
        title: `${node.name} lacks evidenced encryption at rest`,
        scenario: `A storage, snapshot or backup compromise could expose ${node.dataClassification} information held by ${node.name}.`,
        category: "Information Disclosure",
        findingType: "design-threat",
        likelihood: 3,
        impact: node.dataClassification === "restricted" ? 5 : 4,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          strideRef(
            "Information Disclosure",
            "Sensitive persistent data lacks modelled encryption protection.",
          ),
        ],
        attackPath: ["Storage compromise", node.name, "Sensitive data disclosure"],
        controlIds: ["ARGUS-DATA-001", "ARGUS-GOV-001"],
      });
    }
  }
}

function addAiInputRules(model: SystemModel, drafts: ThreatDraft[]): void {
  for (const flow of model.flows.filter((item) => item.untrustedContent)) {
    const source = connectedNode(model, flow.source);
    const target = connectedNode(model, flow.target);
    if (!source || !target || !aiInputKinds.has(target.kind)) continue;
    if (boolAttr(target, "instructionDataSeparation") && boolAttr(target, "promptInjectionTested"))
      continue;

    const isRag =
      target.kind === "rag-pipeline" ||
      source.kind === "external-system" ||
      source.kind === "data-store";
    drafts.push({
      ruleId: "ARGUS-AI-INJECTION-001",
      entityKey: flow.id,
      title: `${isRag ? "Indirect" : "Direct"} prompt injection can influence ${target.name}`,
      scenario: `${source.name} supplies untrusted content to ${target.name}. Embedded instructions may override intended behaviour, influence retrieval or cause unsafe downstream actions.`,
      category: "Prompt Injection / Agent Goal Hijacking",
      findingType: "ai-threat",
      likelihood: 4,
      impact: target.kind === "agent" || target.kind === "agent-orchestrator" ? 5 : 4,
      confidence: "high",
      affectedNodeIds: [source.id, target.id],
      affectedFlowIds: [flow.id],
      frameworks: [
        owaspLlmRef(
          "LLM01:2025",
          "Prompt Injection",
          "Untrusted content is processed by an LLM-capable component.",
        ),
        owaspAgenticRef(
          "ASI01",
          "Agent Goal Hijack",
          "Injected instructions can redirect an agent's goal or plan.",
        ),
        atlasRef(
          "Prompt Injection",
          "The architecture exposes an AI component to attacker-influenced instructions.",
        ),
        maestroRef(
          "Layer 2: Data Operations",
          "The threat enters through data or retrieval operations.",
        ),
      ],
      evidence: [
        evidence(
          "Architecture evidence",
          "The flow is explicitly marked as carrying untrusted content.",
        ),
        evidence(
          "OWASP LLM01:2025",
          "OWASP identifies direct and indirect prompt injection as an LLM application risk.",
          sourceUrls.owaspLlm,
        ),
      ],
      attackPath: [source.name, "Injected instructions", target.name, "Altered goal or output"],
      controlIds: ["ARGUS-AI-001", "ARGUS-AI-002", "ARGUS-AI-006", "ARGUS-AI-007", "ARGUS-OPS-002"],
    });
  }
}

function addAiDataRules(model: SystemModel, drafts: ThreatDraft[]): void {
  for (const node of model.nodes) {
    if (node.kind === "vector-store" && !boolAttr(node, "tenantIsolation")) {
      drafts.push({
        ruleId: "ARGUS-AI-VECTOR-001",
        entityKey: node.id,
        title: `${node.name} may permit cross-context retrieval`,
        scenario: `A query may retrieve another user's or tenant's content because identity-bound filtering and isolation are not evidenced for ${node.name}.`,
        category: "Vector and Embedding Weaknesses",
        findingType: "ai-threat",
        likelihood: 4,
        impact: node.dataClassification === "restricted" ? 5 : 4,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          owaspLlmRef(
            "LLM08:2025",
            "Vector and Embedding Weaknesses",
            "The vector store lacks modelled tenant isolation.",
          ),
          maestroRef(
            "Layer 2: Data Operations",
            "Vector stores and RAG pipelines are modelled in MAESTRO's data layer.",
          ),
        ],
        attackPath: [
          "Authorised user",
          "Cross-context semantic query",
          node.name,
          "Unauthorised content",
        ],
        controlIds: ["ARGUS-DATA-002", "ARGUS-OPS-001", "ARGUS-AI-006"],
        assumptions: [
          "Actual exposure depends on retrieval filters and source-system authorisation.",
        ],
      });
    }

    if (
      (node.kind === "dataset" || node.kind === "rag-pipeline") &&
      !boolAttr(node, "provenanceVerified")
    ) {
      drafts.push({
        ruleId: "ARGUS-AI-POISON-001",
        entityKey: node.id,
        title: `${node.name} has unverified data provenance`,
        scenario: `Malicious, compromised or low-integrity content can enter ${node.name} and influence model outputs or persistent agent behaviour.`,
        category: "Data and Model Poisoning",
        findingType: "ai-threat",
        likelihood: node.exposure === "internet" ? 4 : 3,
        impact: 4,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          owaspLlmRef(
            "LLM04:2025",
            "Data and Model Poisoning",
            "Training or retrieval data provenance is not evidenced.",
          ),
          nistAmlRef("Poisoning attack", "An adversary may manipulate data used by an AI system."),
          atlasRef(
            "Poison Training Data",
            "Attacker-controlled training or adaptation data can alter model behaviour.",
          ),
          maestroRef("Layer 2: Data Operations", "Data integrity is a layer-specific concern."),
        ],
        attackPath: ["Malicious data source", node.name, "Corrupted model context or behaviour"],
        controlIds: ["ARGUS-AI-003", "ARGUS-AI-005", "ARGUS-AI-006", "ARGUS-OPS-002"],
      });
    }

    if (
      (node.kind === "foundation-model" || node.kind === "model-api") &&
      !boolAttr(node, "modelProvenanceVerified")
    ) {
      drafts.push({
        ruleId: "ARGUS-AI-SUPPLY-001",
        entityKey: node.id,
        title: `${node.name} model provenance is not evidenced`,
        scenario: `A tampered, backdoored or substituted model could enter the AI supply chain without integrity and source verification.`,
        category: "AI Supply Chain",
        findingType: "ai-threat",
        likelihood: 3,
        impact: 5,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          owaspLlmRef(
            "LLM03:2025",
            "Supply Chain",
            "The model source and integrity are not modelled as verified.",
          ),
          atlasRef(
            "AI Supply Chain Compromise",
            "A compromised AI artifact can introduce malicious behaviour.",
          ),
          maestroRef(
            "Layer 1: Foundation Models",
            "Foundation model integrity is a layer-specific concern.",
          ),
        ],
        attackPath: ["Compromised model source", node.name, "Backdoored AI behaviour"],
        controlIds: ["ARGUS-AI-005", "ARGUS-SUPPLY-001", "ARGUS-GOV-001"],
      });
    }
  }
}

function addVulnerabilityCandidates(model: SystemModel, drafts: ThreatDraft[]): void {
  for (const node of model.nodes) {
    const cves = stringValues(node, "cveIds").filter((value) => /^CVE-\d{4}-\d{4,}$/i.test(value));
    for (const cve of cves) {
      drafts.push({
        ruleId: "ARGUS-VULN-CANDIDATE",
        entityKey: `${node.id}:${cve.toUpperCase()}`,
        title: `${cve.toUpperCase()} requires applicability verification on ${node.name}`,
        scenario: `${node.name} is associated with ${cve.toUpperCase()} in the architecture inventory. Product, version and configuration applicability must be verified before treating it as confirmed exposure.`,
        category: "Known Vulnerability",
        findingType: "potential-vulnerability",
        likelihood: 3,
        impact: 4,
        confidence: "low",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [],
        evidence: [
          {
            type: "vulnerability",
            title: cve.toUpperCase(),
            url: `https://nvd.nist.gov/vuln/detail/${cve.toUpperCase()}`,
            confidence: "low",
            notes:
              "User-supplied candidate CVE; live NVD, CISA KEV and EPSS enrichment can add evidence, but asset applicability remains a human verification step.",
          },
        ],
        attackPath: ["Known software weakness", node.name, "Potential compromise"],
        controlIds: ["ARGUS-SUPPLY-001", "ARGUS-GOV-001", "ARGUS-OPS-002"],
        assumptions: [
          "A CVE identifier alone does not prove the deployed product and version are affected.",
        ],
      });
    }
  }
}

function addAiOutputRules(model: SystemModel, drafts: ThreatDraft[]): void {
  for (const flow of model.flows) {
    const source = connectedNode(model, flow.source);
    const target = connectedNode(model, flow.target);
    if (!source || !target || !AI_NODE_KINDS.has(source.kind)) continue;

    if (
      (target.kind === "tool" ||
        target.kind === "mcp-server" ||
        executableKinds.has(target.kind)) &&
      !boolAttr(target, "modelOutputValidated")
    ) {
      drafts.push({
        ruleId: "ARGUS-AI-OUTPUT-001",
        entityKey: flow.id,
        title: `Model output can drive ${target.name} without evidenced validation`,
        scenario: `${source.name} produces non-deterministic output that is consumed by ${target.name}. Crafted or malformed output may become an unauthorised command, query or parameter.`,
        category: "Improper Output Handling",
        findingType: "ai-threat",
        likelihood: 4,
        impact: boolAttr(target, "highImpact") || boolAttr(target, "writesData") ? 5 : 4,
        confidence: "medium",
        affectedNodeIds: [source.id, target.id],
        affectedFlowIds: [flow.id],
        frameworks: [
          owaspLlmRef(
            "LLM05:2025",
            "Improper Output Handling",
            "Model output crosses into an executable component without evidenced validation.",
          ),
          owaspAgenticRef(
            "ASI05",
            "Unexpected Code Execution",
            "Unsafe output interpretation can lead to unintended execution.",
          ),
          maestroRef(
            "Layer 3: Agent Frameworks",
            "The agent framework mediates model outputs and tool execution.",
          ),
        ],
        attackPath: [source.name, "Crafted model output", target.name, "Unauthorised action"],
        controlIds: ["ARGUS-AI-002", "ARGUS-IAM-002", "ARGUS-AI-007", "ARGUS-OPS-001"],
      });
    }

    if (target.kind === "actor" && flow.carriesSensitiveData && !boolAttr(source, "outputDlp")) {
      drafts.push({
        ruleId: "ARGUS-AI-DISCLOSURE-001",
        entityKey: flow.id,
        title: `${source.name} may disclose sensitive information`,
        scenario: `${source.name} returns sensitive data to ${target.name} without evidenced output data-loss controls or retrieval-time authorisation.`,
        category: "Sensitive Information Disclosure",
        findingType: "ai-threat",
        likelihood: 3,
        impact: 5,
        confidence: "medium",
        affectedNodeIds: [source.id, target.id],
        affectedFlowIds: [flow.id],
        frameworks: [
          owaspLlmRef(
            "LLM02:2025",
            "Sensitive Information Disclosure",
            "The model output is marked as carrying sensitive data.",
          ),
          maestroRef(
            "Layer 6: Security and Compliance",
            "Sensitive AI data requires controls across the stack.",
          ),
        ],
        attackPath: ["Sensitive context", source.name, "Unfiltered response", target.name],
        controlIds: ["ARGUS-DATA-001", "ARGUS-DATA-002", "ARGUS-OPS-001", "ARGUS-AI-006"],
      });
    }
  }
}

function addAgenticRules(model: SystemModel, drafts: ThreatDraft[]): void {
  for (const flow of model.flows) {
    const source = connectedNode(model, flow.source);
    const target = connectedNode(model, flow.target);
    if (!source || !target) continue;

    if (
      (source.kind === "agent" || source.kind === "agent-orchestrator") &&
      (target.kind === "tool" || target.kind === "mcp-server")
    ) {
      const highImpact =
        boolAttr(target, "highImpact") ||
        boolAttr(target, "writesData") ||
        boolAttr(target, "executesCode");
      if (highImpact && !pathHasHumanApproval(model, source.id, target.id)) {
        drafts.push({
          ruleId: "ARGUS-AGENT-AGENCY-001",
          entityKey: flow.id,
          title: `${source.name} can invoke high-impact ${target.name} without approval`,
          scenario: `A manipulated or faulty agent can invoke ${target.name} directly, allowing non-deterministic model behaviour to cause consequential actions without informed human approval.`,
          category: "Excessive Agency / Tool Misuse",
          findingType: "ai-threat",
          likelihood: 4,
          impact: 5,
          confidence: "high",
          affectedNodeIds: [source.id, target.id],
          affectedFlowIds: [flow.id],
          frameworks: [
            owaspLlmRef(
              "LLM06:2025",
              "Excessive Agency",
              "The agent has functionality and autonomy to perform a high-impact action.",
            ),
            owaspAgenticRef(
              "ASI02",
              "Tool Misuse",
              "The tool can be used outside intended business constraints.",
            ),
            owaspAgenticRef(
              "ASI03",
              "Identity and Privilege Abuse",
              "The agent's effective identity may authorise high-impact operations.",
            ),
            maestroRef(
              "Layer 7: Agent Ecosystem",
              "Agent-to-tool action is part of the operational ecosystem.",
            ),
          ],
          attackPath: ["Manipulated agent context", source.name, target.name, "High-impact action"],
          controlIds: [
            "ARGUS-IAM-002",
            "ARGUS-IAM-003",
            "ARGUS-AI-002",
            "ARGUS-AI-007",
            "ARGUS-OPS-001",
          ],
        });
      }
    }

    if (
      (source.kind === "agent" || source.kind === "agent-orchestrator") &&
      (target.kind === "agent" || target.kind === "agent-orchestrator") &&
      (!flow.authenticated || !flow.encrypted)
    ) {
      drafts.push({
        ruleId: "ARGUS-AGENT-A2A-001",
        entityKey: flow.id,
        title: `Insecure communication between ${source.name} and ${target.name}`,
        scenario: `A malicious party can impersonate an agent or alter agent-to-agent messages, propagating false goals, context or results through the system.`,
        category: "Insecure Inter-Agent Communication",
        findingType: "ai-threat",
        likelihood: 4,
        impact: 5,
        confidence: "high",
        affectedNodeIds: [source.id, target.id],
        affectedFlowIds: [flow.id],
        frameworks: [
          owaspAgenticRef(
            "ASI07",
            "Insecure Inter-Agent Communication",
            "Agent messages are not mutually authenticated and encrypted.",
          ),
          maestroRef(
            "Layer 7: Agent Ecosystem",
            "MAESTRO explicitly considers multi-agent identity and communication.",
          ),
          strideRef(
            "Spoofing / Tampering",
            "The communication channel lacks identity or integrity protection.",
          ),
        ],
        attackPath: [
          "Malicious agent",
          "Forged or modified message",
          target.name,
          "Cascading agent action",
        ],
        controlIds: ["ARGUS-IAM-001", "ARGUS-DATA-001", "ARGUS-AI-007", "ARGUS-OPS-001"],
      });
    }

    if (
      target.kind === "memory" &&
      flow.untrustedContent &&
      !boolAttr(target, "provenanceVerified")
    ) {
      drafts.push({
        ruleId: "ARGUS-AGENT-MEMORY-001",
        entityKey: flow.id,
        title: `Untrusted content can persist in ${target.name}`,
        scenario: `An attacker can write durable instructions or false observations into ${target.name}, influencing later sessions, users or agent decisions.`,
        category: "Memory and Context Poisoning",
        findingType: "ai-threat",
        likelihood: 4,
        impact: 5,
        confidence: "high",
        affectedNodeIds: [source.id, target.id],
        affectedFlowIds: [flow.id],
        frameworks: [
          owaspAgenticRef(
            "ASI06",
            "Memory and Context Poisoning",
            "Attacker-influenced content can become persistent agent state.",
          ),
          maestroRef("Layer 2: Data Operations", "Agent memory is a persistent data operation."),
        ],
        attackPath: [source.name, "Poisoned context", target.name, "Future agent execution"],
        controlIds: ["ARGUS-AI-004", "ARGUS-AI-003", "ARGUS-AI-006", "ARGUS-OPS-002"],
      });
    }
  }

  for (const node of model.nodes.filter(
    (item) => item.kind === "agent" || item.kind === "agent-orchestrator",
  )) {
    if (boolAttr(node, "dynamicAgentCreation") && !boolAttr(node, "agentRegistryEnforced")) {
      drafts.push({
        ruleId: "ARGUS-AGENT-ROGUE-001",
        entityKey: node.id,
        title: `${node.name} can create unregistered agents`,
        scenario: `A compromised or misdirected orchestrator can create agents without approved identity, capability, owner or policy registration.`,
        category: "Rogue Agents",
        findingType: "ai-threat",
        likelihood: 3,
        impact: 5,
        confidence: "high",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          owaspAgenticRef(
            "ASI10",
            "Rogue Agents",
            "Dynamic agent creation is not bound to an enforced registry.",
          ),
          maestroRef(
            "Layer 7: Agent Ecosystem",
            "Agent discovery and registry integrity are ecosystem concerns.",
          ),
        ],
        attackPath: [node.name, "Unregistered agent creation", "Uncontrolled identity and tools"],
        controlIds: ["ARGUS-IAM-001", "ARGUS-IAM-002", "ARGUS-AI-007", "ARGUS-GOV-001"],
      });
    }

    if (
      !boolAttr(node, "circuitBreaker") &&
      model.flows.filter((flow) => flow.source === node.id).length >= 2
    ) {
      drafts.push({
        ruleId: "ARGUS-AGENT-CASCADE-001",
        entityKey: node.id,
        title: `${node.name} lacks an evidenced cascade boundary`,
        scenario: `A faulty decision, dependency failure or malicious instruction can propagate through multiple downstream tools or agents without bounded retries, spend or an operator stop condition.`,
        category: "Cascading Failures",
        findingType: "ai-threat",
        likelihood: 3,
        impact: 5,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: model.flows
          .filter((flow) => flow.source === node.id)
          .map((flow) => flow.id),
        frameworks: [
          owaspAgenticRef(
            "ASI08",
            "Cascading Failures",
            "One agent can influence multiple downstream components without an evidenced circuit breaker.",
          ),
          maestroRef(
            "Cross-Layer Threats",
            "Failure and goal misalignment can propagate across MAESTRO layers.",
          ),
        ],
        attackPath: [node.name, "Unbounded failure propagation", "Multiple downstream systems"],
        controlIds: ["ARGUS-AI-007", "ARGUS-APP-002", "ARGUS-OPS-002"],
        assumptions: [
          "Actual cascade behaviour depends on retry, transaction and compensation implementation.",
        ],
      });
    }
  }
}

function addModelAttackRules(model: SystemModel, drafts: ThreatDraft[]): void {
  for (const node of model.nodes.filter(
    (item) => item.kind === "foundation-model" || item.kind === "model-api",
  )) {
    if (
      node.exposure === "internet" &&
      (!boolAttr(node, "rateLimited") || !boolAttr(node, "extractionMonitoring"))
    ) {
      drafts.push({
        ruleId: "ARGUS-AML-EXTRACT-001",
        entityKey: node.id,
        title: `${node.name} may be susceptible to model extraction`,
        scenario: `An adversary can systematically query ${node.name} to approximate proprietary behaviour, infer decision boundaries or prepare evasive attacks.`,
        category: "Model Extraction",
        findingType: "ai-threat",
        likelihood: 3,
        impact: 4,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          nistAmlRef(
            "Model extraction",
            "Public query access can enable repeated observation of model behaviour.",
          ),
          atlasRef(
            "Exfiltration via AI Inference API",
            "Inference access can be abused to extract information about a model.",
          ),
          maestroRef(
            "Layer 1: Foundation Models",
            "Model theft and extraction are foundation-model threats.",
          ),
        ],
        attackPath: [
          "External caller",
          "Adaptive inference queries",
          node.name,
          "Model approximation",
        ],
        controlIds: ["ARGUS-APP-002", "ARGUS-OPS-002", "ARGUS-AI-006"],
      });
    }

    if (boolAttr(node, "trainedOnSensitiveData") && !boolAttr(node, "privacyEvaluated")) {
      drafts.push({
        ruleId: "ARGUS-AML-PRIVACY-001",
        entityKey: node.id,
        title: `${node.name} lacks evidenced privacy attack evaluation`,
        scenario: `An adversary may infer whether sensitive records were present in training data or recover information through targeted queries.`,
        category: "Membership Inference / Privacy Attack",
        findingType: "ai-threat",
        likelihood: 3,
        impact: 5,
        confidence: "medium",
        affectedNodeIds: [node.id],
        affectedFlowIds: [],
        frameworks: [
          nistAmlRef(
            "Privacy attack",
            "The model is trained on sensitive data without evidenced privacy testing.",
          ),
          atlasRef(
            "Infer Training Data Membership",
            "Adversaries may infer whether a data record was used for training.",
          ),
          maestroRef("Layer 1: Foundation Models", "Membership inference is a model-layer threat."),
        ],
        attackPath: [
          "External or authorised caller",
          "Targeted queries",
          node.name,
          "Training data inference",
        ],
        controlIds: ["ARGUS-AI-006", "ARGUS-DATA-001", "ARGUS-APP-002", "ARGUS-GOV-001"],
      });
    }
  }
}

export function inferAnalysisMode(model: SystemModel): AnalysisMode {
  if (model.systemKind !== "auto") return model.systemKind;
  const kinds = model.nodes.map((node) => node.kind);
  const hasAgent = kinds.some((kind) => AGENTIC_NODE_KINDS.has(kind));
  const hasActionSurface =
    hasKind(model, "tool") || hasKind(model, "mcp-server") || hasKind(model, "memory");
  if (hasAgent && hasActionSurface) return "agentic";
  if (kinds.some((kind) => AI_NODE_KINDS.has(kind))) return "ai";
  return "standard";
}

export function runThreatRules(model: SystemModel): { mode: AnalysisMode; threats: Threat[] } {
  const mode = inferAnalysisMode(model);
  const drafts: ThreatDraft[] = [];
  addTransportRules(model, drafts);
  addComponentRules(model, drafts);
  addVulnerabilityCandidates(model, drafts);
  if (mode === "ai" || mode === "agentic") {
    addAiInputRules(model, drafts);
    addAiDataRules(model, drafts);
    addAiOutputRules(model, drafts);
    addModelAttackRules(model, drafts);
  }
  if (mode === "agentic") addAgenticRules(model, drafts);

  const threats = drafts
    .map((draft) => makeThreat(model, draft))
    .sort((left, right) => right.riskScore - left.riskScore || left.id.localeCompare(right.id));
  return { mode, threats };
}
