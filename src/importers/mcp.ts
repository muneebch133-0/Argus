import type { ArchitectureNode, DataFlow } from "../shared/schemas.js";
import type { ImportResult } from "./types.js";
import {
  asRecord,
  draftModel,
  fileStem,
  inferredAttributes,
  position,
  safeId,
  sourceEvidence,
  stringValue,
} from "./utils.js";

export function isMcpConfig(document: unknown): boolean {
  return Object.keys(asRecord(asRecord(document).mcpServers)).length > 0;
}

function hasCredentialConfiguration(server: Record<string, unknown>): boolean {
  const names = [
    ...Object.keys(asRecord(server.headers)),
    ...Object.keys(asRecord(server.env)),
  ].map((key) => key.toLowerCase());
  return names.some((name) => /(authorization|token|api[_-]?key|secret|credential)/.test(name));
}

export function importMcpConfig(document: unknown, filename: string): ImportResult {
  const servers = asRecord(asRecord(document).mcpServers);
  const names = Object.keys(servers);
  const agentId = safeId("agent", `${filename}-agent`);
  const nodes: ArchitectureNode[] = [
    {
      id: agentId,
      name: "AI agent / host",
      kind: "agent",
      description: "Agent host inferred from an MCP client configuration.",
      trustZone: "application",
      exposure: "internal",
      dataClassification: "internal",
      position: position(0),
      attributes: inferredAttributes("agent"),
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence(
          "mcp-config",
          filename,
          "mcpServers",
          `${names.length} MCP server entries are configured.`,
        ),
      ],
    },
  ];
  const flows: DataFlow[] = [];
  for (const [index, name] of names.entries()) {
    const server = asRecord(servers[name]);
    const url = stringValue(server.url);
    const command = stringValue(server.command);
    const remote = Boolean(url);
    const authenticated = hasCredentialConfiguration(server);
    const secureTransport = Boolean(url && /^https:\/\//i.test(url));
    const serverId = safeId("mcp", name);
    nodes.push({
      id: serverId,
      name,
      kind: "mcp-server",
      description: url
        ? `Remote MCP server declared with ${secureTransport ? "HTTPS" : "non-HTTPS or custom"} transport.`
        : command
          ? "Local MCP server launched with a configured command."
          : "MCP server with an unspecified transport.",
      trustZone: remote ? "external-services" : "local-runtime",
      exposure: remote ? "partner" : "internal",
      dataClassification: "internal",
      position: position(index + 1),
      attributes: {
        ...inferredAttributes("mcp-server"),
        transport: url ? "remote" : command ? "stdio" : "unknown",
        credentialConfigurationDetected: authenticated,
      },
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence(
          "mcp-config",
          filename,
          `mcpServers.${name}`,
          `${remote ? "Remote" : "Local or unspecified"} MCP server entry detected; secret values were not copied.`,
        ),
      ],
    });
    flows.push({
      id: safeId("flow", `${agentId}-${serverId}`),
      source: agentId,
      target: serverId,
      label: "MCP tool and resource calls",
      protocol: secureTransport ? "HTTPS" : command ? "stdio" : "unspecified",
      authenticated,
      encrypted: secureTransport || Boolean(command),
      carriesSensitiveData: false,
      untrustedContent: true,
      crossesTrustBoundary: remote,
      reviewStatus: "needs-review",
      evidence: [
        sourceEvidence(
          "mcp-config",
          filename,
          `mcpServers.${name}`,
          `Agent host can communicate with MCP server ${name}; effective tool permissions require confirmation.`,
        ),
      ],
    });
  }
  return {
    format: "mcp-config",
    formatLabel: "MCP client configuration",
    model: draftModel(
      fileStem(filename) || "MCP agent system",
      `Draft generated from ${filename}.`,
      nodes,
      flows,
      "agentic",
    ),
    warnings: [
      "Credential field names are detected, but secret values are never copied into the model.",
      "An MCP configuration does not enumerate effective tool permissions or downstream systems; add and review them manually.",
    ],
    sourceCount: names.length,
  };
}
