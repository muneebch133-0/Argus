import {
  draftModel,
  inferredAttributes,
  position,
  safeId,
  sourceEvidence,
} from "../importers/utils.js";
import type {
  ArchitectureNode,
  DataFlow,
  InterviewProfile,
  SystemModel,
} from "../shared/schemas.js";

function list(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
}

export interface InterviewDraft {
  model: SystemModel;
  warnings: string[];
}

export function buildInterviewDraft(profile: InterviewProfile): InterviewDraft {
  const nodes: ArchitectureNode[] = [];
  const flows: DataFlow[] = [];
  const evidence = (locator: string, observation: string) => [
    sourceEvidence("interview", "Architecture interview", locator, observation, "medium"),
  ];
  const addNode = (
    name: string,
    kind: ArchitectureNode["kind"],
    patch: Partial<ArchitectureNode> = {},
    locator = "system",
  ): ArchitectureNode => {
    const node: ArchitectureNode = {
      id: safeId("interview", `${kind}-${name}-${nodes.length}`),
      name,
      kind,
      description: "Component proposed from architecture interview answers.",
      trustZone: "application",
      exposure: "internal",
      dataClassification: "internal",
      position: position(nodes.length),
      attributes: inferredAttributes(kind),
      reviewStatus: "needs-review",
      evidence: evidence(locator, `The interview indicates a ${kind} named ${name}.`),
      ...patch,
    };
    nodes.push(node);
    return node;
  };
  const addFlow = (
    source: ArchitectureNode,
    target: ArchitectureNode,
    label: string,
    patch: Partial<DataFlow> = {},
    locator = "system",
  ): void => {
    flows.push({
      id: safeId("flow", `${source.id}-${target.id}-${label}`),
      source: source.id,
      target: target.id,
      label,
      protocol: profile.encryption ? "HTTPS" : "unspecified",
      authenticated: profile.authentication,
      encrypted: profile.encryption,
      carriesSensitiveData: profile.sensitiveData,
      untrustedContent: source.kind === "actor" || source.kind === "external-system",
      crossesTrustBoundary: source.trustZone !== target.trustZone,
      reviewStatus: "needs-review",
      evidence: evidence(
        locator,
        `The interview suggests ${source.name} communicates with ${target.name}.`,
      ),
      ...patch,
    });
  };

  const actor = addNode(
    profile.primaryUsers || "Users",
    "actor",
    {
      description: "Primary user population supplied during the architecture interview.",
      trustZone: profile.internetExposed ? "internet" : "corporate",
      exposure: profile.internetExposed ? "internet" : "internal",
    },
    "primaryUsers",
  );
  const application = addNode(
    profile.name,
    "application",
    {
      description:
        profile.description || "Primary application defined by the architecture interview.",
      exposure: profile.internetExposed ? "internet" : "internal",
      attributes: {
        ...inferredAttributes("application"),
        auditLogging: profile.auditLogging,
        inputValidation: false,
      },
    },
    "name/description",
  );
  addFlow(
    actor,
    application,
    "application access",
    { crossesTrustBoundary: profile.internetExposed },
    "internetExposed",
  );

  if (profile.dataStores.trim() || profile.sensitiveData) {
    const stores = list(profile.dataStores);
    const names = stores.length > 0 ? stores : ["Application data store"];
    for (const name of names) {
      const store = addNode(
        name,
        "data-store",
        {
          dataClassification: profile.sensitiveData ? "confidential" : "internal",
          attributes: {
            ...inferredAttributes("data-store"),
            encryptedAtRest: profile.encryption,
          },
        },
        "dataStores/sensitiveData",
      );
      addFlow(application, store, "application data", {}, "dataStores");
    }
  }

  for (const name of list(profile.externalSystems)) {
    const external = addNode(
      name,
      "external-system",
      {
        trustZone: "third-party",
        exposure: "partner",
      },
      "externalSystems",
    );
    addFlow(
      application,
      external,
      "external integration",
      { crossesTrustBoundary: true },
      "externalSystems",
    );
  }

  let aiTarget: ArchitectureNode | undefined;
  if (profile.usesAi) {
    aiTarget = addNode(
      "Model API",
      "model-api",
      {
        trustZone: "ai-platform",
        exposure: "partner",
      },
      "usesAi",
    );
  }

  if (profile.usesRag) {
    const rag = addNode("RAG pipeline", "rag-pipeline", {}, "usesRag");
    const vector = addNode(
      "Vector store",
      "vector-store",
      {
        dataClassification: profile.sensitiveData ? "confidential" : "internal",
      },
      "usesRag",
    );
    addFlow(application, rag, "retrieval request", { untrustedContent: true }, "usesRag");
    addFlow(rag, vector, "similarity search", {}, "usesRag");
    if (aiTarget) addFlow(rag, aiTarget, "grounded prompt", { untrustedContent: true }, "usesRag");
  }

  if (profile.usesAgents) {
    const agent = addNode(
      "AI agent",
      "agent",
      {
        attributes: {
          ...inferredAttributes("agent"),
          highImpact: profile.highImpactActions,
          auditLogging: profile.auditLogging,
        },
      },
      "usesAgents/highImpactActions",
    );
    addFlow(application, agent, "delegated task", { untrustedContent: true }, "usesAgents");
    if (aiTarget)
      addFlow(agent, aiTarget, "model inference", { crossesTrustBoundary: true }, "usesAi");
    const toolNames = list(profile.agentTools);
    const tools = toolNames.length > 0 ? toolNames : ["Agent tool"];
    let approval: ArchitectureNode | undefined;
    if (profile.humanApproval) {
      approval = addNode("Human approval", "human-approval", {}, "humanApproval");
      addFlow(
        agent,
        approval,
        "approval request",
        { carriesSensitiveData: false },
        "humanApproval",
      );
    }
    for (const name of tools) {
      const tool = addNode(
        name,
        "tool",
        {
          attributes: {
            ...inferredAttributes("tool"),
            highImpact: profile.highImpactActions,
            writesData: profile.highImpactActions,
          },
        },
        "agentTools",
      );
      addFlow(approval ?? agent, tool, "tool invocation", { untrustedContent: true }, "agentTools");
    }
  } else if (aiTarget && !profile.usesRag) {
    addFlow(
      application,
      aiTarget,
      "model inference",
      { crossesTrustBoundary: true, untrustedContent: true },
      "usesAi",
    );
  }

  if (profile.auditLogging) {
    addNode(
      "Security observability",
      "observability",
      { description: "Logging or monitoring capability reported during the interview." },
      "auditLogging",
    );
  }

  const detectedKind: SystemModel["systemKind"] = profile.usesAgents
    ? "agentic"
    : profile.usesAi || profile.usesRag
      ? "ai"
      : profile.systemKind;
  const model = draftModel(profile.name, profile.description, nodes, flows, detectedKind);
  model.businessCriticality = profile.businessCriticality;
  const warnings = [
    "Every generated component and flow is a suggestion until a reviewer confirms its evidence.",
  ];
  if (profile.usesAgents && !profile.humanApproval && profile.highImpactActions) {
    warnings.push("High-impact agent actions are reported without a human approval step.");
  }
  if (profile.sensitiveData && !profile.encryption) {
    warnings.push("Sensitive data is reported but encryption is not evidenced.");
  }
  if (!profile.auditLogging)
    warnings.push("Audit logging is not evidenced by the interview answers.");
  return { model, warnings };
}
