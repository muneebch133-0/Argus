import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import {
  Activity,
  Bot,
  Boxes,
  BrainCircuit,
  Database,
  ExternalLink,
  GitBranch,
  HardDrive,
  MemoryStick,
  Network,
  PlugZap,
  Search,
  Server,
  ShieldCheck,
  UserCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import type { ArchitectureNode as ArchitectureNodeModel } from "../../shared/schemas.js";

export type ArchitectureGraphNode = Node<
  { architecture: ArchitectureNodeModel; selectedByUser: boolean },
  "architecture"
>;

function iconFor(kind: ArchitectureNodeModel["kind"]): React.ReactNode {
  const props = { size: 16, strokeWidth: 1.8 };
  switch (kind) {
    case "actor":
      return <UserRound {...props} />;
    case "external-system":
      return <ExternalLink {...props} />;
    case "application":
      return <Boxes {...props} />;
    case "api":
      return <Network {...props} />;
    case "service":
      return <Server {...props} />;
    case "data-store":
      return <Database {...props} />;
    case "foundation-model":
    case "model-api":
      return <BrainCircuit {...props} />;
    case "agent":
    case "agent-orchestrator":
      return <Bot {...props} />;
    case "tool":
      return <Wrench {...props} />;
    case "mcp-server":
      return <PlugZap {...props} />;
    case "rag-pipeline":
      return <Search {...props} />;
    case "vector-store":
      return <HardDrive {...props} />;
    case "memory":
      return <MemoryStick {...props} />;
    case "dataset":
    case "model-registry":
      return <GitBranch {...props} />;
    case "guardrail":
      return <ShieldCheck {...props} />;
    case "human-approval":
      return <UserCheck {...props} />;
    case "observability":
      return <Activity {...props} />;
  }
}

export function ArchitectureNode({ data }: NodeProps<ArchitectureGraphNode>): React.ReactNode {
  const node = data.architecture;
  const family =
    node.kind === "actor" || node.kind === "external-system"
      ? "actor"
      : ["application", "api", "service", "data-store"].includes(node.kind)
        ? "system"
        : ["guardrail", "human-approval", "observability"].includes(node.kind)
          ? "control"
          : "ai";
  return (
    <div
      className={`architecture-node architecture-node--${family} ${data.selectedByUser ? "is-selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="architecture-node__topline">
        <span className="architecture-node__icon">{iconFor(node.kind)}</span>
        <span className="architecture-node__kind">{node.kind.replaceAll("-", " ")}</span>
      </div>
      <strong>{node.name}</strong>
      <span className="architecture-node__zone">{node.trustZone}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
