import {
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeMouseHandler,
  MarkerType,
  MiniMap,
  type NodeMouseHandler,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Braces,
  ChevronDown,
  Download,
  FileJson,
  Play,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import agenticSampleJson from "../../examples/agentic-rag.json";
import paymentSampleJson from "../../examples/payment-api.json";
import { NODE_KIND_LABELS } from "../shared/constants.js";
import {
  type AnalysisResult,
  type ArchitectureNode,
  type DataFlow,
  type SystemModel,
  systemModelSchema,
} from "../shared/schemas.js";
import {
  type ArchitectureGraphNode,
  ArchitectureNode as ArchitectureNodeCard,
} from "./components/ArchitectureNode.js";
import { Inspector } from "./components/Inspector.js";
import { Palette } from "./components/Palette.js";
import { ResultsPanel } from "./components/ResultsPanel.js";
import { analyzeArchitecture } from "./lib/api.js";
import { exportAnalysisJson, exportAnalysisMarkdown, exportModel } from "./lib/export.js";

const agenticSample = systemModelSchema.parse(agenticSampleJson);
const paymentSample = systemModelSchema.parse(paymentSampleJson);
const STORAGE_KEY = "argus:model:v1";

const nodeTypes = { architecture: ArchitectureNodeCard };

function initialModel(): SystemModel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return systemModelSchema.parse(JSON.parse(stored));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return agenticSample;
}

function defaultAttributes(kind: ArchitectureNode["kind"]): ArchitectureNode["attributes"] {
  const attributes: ArchitectureNode["attributes"] = { auditLogging: false };
  if (
    ["application", "api", "service", "agent", "agent-orchestrator", "tool", "mcp-server"].includes(
      kind,
    )
  ) {
    attributes.inputValidation = false;
    attributes.rateLimited = false;
  }
  if (["data-store", "vector-store", "memory", "dataset"].includes(kind))
    attributes.encryptedAtRest = false;
  if (["foundation-model", "model-api"].includes(kind)) attributes.modelProvenanceVerified = false;
  if (kind === "vector-store") attributes.tenantIsolation = false;
  if (["dataset", "rag-pipeline", "memory"].includes(kind)) attributes.provenanceVerified = false;
  if (["agent", "agent-orchestrator"].includes(kind)) attributes.circuitBreaker = false;
  if (["tool", "mcp-server"].includes(kind)) attributes.modelOutputValidated = false;
  return attributes;
}

function toGraphNodes(model: SystemModel, selectedNodeId: string | null): ArchitectureGraphNode[] {
  return model.nodes.map((node) => ({
    id: node.id,
    type: "architecture",
    position: node.position,
    data: { architecture: node, selectedByUser: node.id === selectedNodeId },
  }));
}

function toGraphEdges(model: SystemModel, selectedFlowId: string | null): Edge[] {
  return model.flows.map((flow) => ({
    id: flow.id,
    source: flow.source,
    target: flow.target,
    label: flow.label,
    type: "smoothstep",
    animated: flow.untrustedContent,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: {
      stroke:
        flow.id === selectedFlowId ? "#53d7ff" : flow.untrustedContent ? "#f6b84a" : "#61768e",
      strokeWidth: flow.id === selectedFlowId ? 2.2 : 1.5,
    },
    labelStyle: { fill: "#9fb0c4", fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: "#0b1727", fillOpacity: 0.94 },
    labelBgPadding: [5, 3],
    labelBgBorderRadius: 4,
  }));
}

function AppShell(): React.ReactNode {
  const [model, setModel] = useState<SystemModel>(initialModel);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<"design" | "results">("design");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  }, [model]);

  const graphNodes = useMemo(() => toGraphNodes(model, selectedNodeId), [model, selectedNodeId]);
  const graphEdges = useMemo(() => toGraphEdges(model, selectedFlowId), [model, selectedFlowId]);
  const selectedNode = model.nodes.find((node) => node.id === selectedNodeId);
  const selectedFlow = model.flows.find((flow) => flow.id === selectedFlowId);

  const clearAnalysis = (): void => {
    setAnalysis(null);
    setMessage("Architecture changed — run analysis to refresh findings.");
  };

  const updateModel = (updater: (current: SystemModel) => SystemModel): void => {
    setModel((current) => updater(current));
    if (analysis) clearAnalysis();
  };

  const selectNode: NodeMouseHandler<ArchitectureGraphNode> = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
    setSelectedFlowId(null);
    setRightMode("design");
  }, []);

  const selectEdge: EdgeMouseHandler = useCallback((_event, edge) => {
    setSelectedFlowId(edge.id);
    setSelectedNodeId(null);
    setRightMode("design");
  }, []);

  const addNode = (kind: ArchitectureNode["kind"]): void => {
    const shortId = crypto.randomUUID().slice(0, 8);
    const id = `${kind}-${shortId}`;
    const node: ArchitectureNode = {
      id,
      name: NODE_KIND_LABELS[kind],
      kind,
      description: "",
      trustZone: kind === "actor" || kind === "external-system" ? "internet" : "application",
      exposure: kind === "actor" || kind === "external-system" ? "internet" : "internal",
      dataClassification: "internal",
      position: {
        x: 80 + (model.nodes.length % 3) * 240,
        y: 80 + (Math.floor(model.nodes.length / 3) % 4) * 170,
      },
      attributes: defaultAttributes(kind),
    };
    updateModel((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedNodeId(id);
    setSelectedFlowId(null);
    setRightMode("design");
  };

  const connect = (connection: Connection): void => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const id = `flow-${crypto.randomUUID().slice(0, 8)}`;
    const flow: DataFlow = {
      id,
      source: connection.source,
      target: connection.target,
      label: "data flow",
      protocol: "HTTPS",
      authenticated: true,
      encrypted: true,
      carriesSensitiveData: false,
      untrustedContent: false,
      crossesTrustBoundary: false,
    };
    updateModel((current) => ({ ...current, flows: [...current.flows, flow] }));
    setSelectedFlowId(id);
    setSelectedNodeId(null);
  };

  const runAnalysis = async (): Promise<void> => {
    setRunning(true);
    setMessage(null);
    try {
      const result = await analyzeArchitecture(model);
      setAnalysis(result);
      setRightMode("results");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const loadSample = (sample: SystemModel): void => {
    setModel(structuredClone(sample));
    setAnalysis(null);
    setSelectedNodeId(null);
    setSelectedFlowId(null);
    setRightMode("design");
    setSampleOpen(false);
    setMessage(`${sample.name} loaded.`);
  };

  const importModel = async (file: File): Promise<void> => {
    try {
      const imported = systemModelSchema.parse(JSON.parse(await file.text()));
      loadSample(imported);
      setMessage(`${file.name} imported and validated.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? `Import failed: ${error.message}` : "Import failed");
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <ScanSearch size={20} />
          </div>
          <div>
            <strong>ARGUS</strong>
            <span>Threat intelligence, by design</span>
          </div>
        </div>
        <div className="header-context">
          <span className="mode-pill">
            <Sparkles size={13} /> {model.systemKind === "auto" ? "Auto-detect" : model.systemKind}
          </span>
          <span className="header-system-name">{model.name}</span>
        </div>
        <nav className="header-actions">
          <div className="dropdown">
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setSampleOpen((value) => !value)}
            >
              Examples <ChevronDown size={15} />
            </button>
            {sampleOpen ? (
              <div className="dropdown-menu">
                <button type="button" onClick={() => loadSample(agenticSample)}>
                  <Sparkles size={15} />
                  <span>
                    <strong>Agentic customer support</strong>
                    <small>MAESTRO, ATLAS, OWASP AI</small>
                  </span>
                </button>
                <button type="button" onClick={() => loadSample(paymentSample)}>
                  <Braces size={15} />
                  <span>
                    <strong>Payment API</strong>
                    <small>Traditional STRIDE</small>
                  </span>
                </button>
              </div>
            ) : null}
          </div>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importModel(file);
              event.target.value = "";
            }}
          />
          <button
            className="icon-button"
            type="button"
            title="Import Argus JSON"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Export architecture JSON"
            onClick={() => exportModel(model)}
          >
            <Download size={17} />
          </button>
          {analysis ? (
            <div className="dropdown export-dropdown">
              <button className="button button--ghost" type="button">
                <FileJson size={15} /> Report <ChevronDown size={14} />
              </button>
              <div className="dropdown-menu dropdown-menu--right export-menu">
                <button type="button" onClick={() => exportAnalysisMarkdown(model, analysis)}>
                  <span>
                    <strong>Markdown report</strong>
                    <small>Reviewable and version controlled</small>
                  </span>
                </button>
                <button type="button" onClick={() => exportAnalysisJson(model, analysis)}>
                  <span>
                    <strong>JSON evidence</strong>
                    <small>Machine-readable model and findings</small>
                  </span>
                </button>
              </div>
            </div>
          ) : null}
          <button
            className="button button--primary"
            type="button"
            disabled={running}
            onClick={() => void runAnalysis()}
          >
            {running ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
            {running ? "Analysing" : "Run analysis"}
          </button>
        </nav>
      </header>
      {message ? (
        <div className="status-banner" role="status">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      <main className="workspace">
        <Palette onAdd={addNode} />
        <section className="canvas-wrap" aria-label="Architecture canvas">
          <div className="canvas-label">
            <span className="pulse" /> Architecture workspace{" "}
            <small>
              {model.nodes.length} components · {model.flows.length} flows
            </small>
          </div>
          <ReactFlow
            nodes={graphNodes}
            edges={graphEdges}
            nodeTypes={nodeTypes}
            onNodeClick={selectNode}
            onEdgeClick={selectEdge}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedFlowId(null);
            }}
            onConnect={connect}
            onNodeDragStop={(_event, graphNode) =>
              updateModel((current) => ({
                ...current,
                nodes: current.nodes.map((node) =>
                  node.id === graphNode.id ? { ...node, position: graphNode.position } : node,
                ),
              }))
            }
            onNodesDelete={(deleted) => {
              const deletedIds = new Set(deleted.map((node) => node.id));
              updateModel((current) => ({
                ...current,
                nodes: current.nodes.filter((node) => !deletedIds.has(node.id)),
                flows: current.flows.filter(
                  (flow) => !deletedIds.has(flow.source) && !deletedIds.has(flow.target),
                ),
              }));
              setSelectedNodeId(null);
            }}
            onEdgesDelete={(deleted) => {
              const deletedIds = new Set(deleted.map((edge) => edge.id));
              updateModel((current) => ({
                ...current,
                flows: current.flows.filter((flow) => !deletedIds.has(flow.id)),
              }));
              setSelectedFlowId(null);
            }}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.25}
            maxZoom={1.8}
            colorMode="dark"
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background color="#1a2b40" gap={26} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(5, 13, 24, 0.72)"
              nodeColor={(node) => {
                const kind = (node.data?.architecture as ArchitectureNode | undefined)?.kind;
                return kind &&
                  ["agent", "agent-orchestrator", "foundation-model", "model-api"].includes(kind)
                  ? "#8b7cff"
                  : "#3cbddf";
              }}
            />
          </ReactFlow>
        </section>
        <aside className="right-panel">
          <div className="right-panel-tabs">
            <button
              type="button"
              className={rightMode === "design" ? "active" : ""}
              onClick={() => setRightMode("design")}
            >
              Design
            </button>
            <button
              type="button"
              className={rightMode === "results" ? "active" : ""}
              disabled={!analysis}
              onClick={() => setRightMode("results")}
            >
              Findings {analysis ? <span>{analysis.summary.total}</span> : null}
            </button>
          </div>
          {rightMode === "results" && analysis ? (
            <ResultsPanel result={analysis} />
          ) : (
            <Inspector
              model={model}
              {...(selectedNode ? { selectedNode } : {})}
              {...(selectedFlow ? { selectedFlow } : {})}
              onModelChange={(patch) => updateModel((current) => ({ ...current, ...patch }))}
              onNodeChange={(id, patch) =>
                updateModel((current) => ({
                  ...current,
                  nodes: current.nodes.map((node) =>
                    node.id === id ? { ...node, ...patch } : node,
                  ),
                }))
              }
              onFlowChange={(id, patch) =>
                updateModel((current) => ({
                  ...current,
                  flows: current.flows.map((flow) =>
                    flow.id === id ? { ...flow, ...patch } : flow,
                  ),
                }))
              }
              onDeleteNode={(id) => {
                updateModel((current) => ({
                  ...current,
                  nodes: current.nodes.filter((node) => node.id !== id),
                  flows: current.flows.filter((flow) => flow.source !== id && flow.target !== id),
                }));
                setSelectedNodeId(null);
              }}
              onDeleteFlow={(id) => {
                updateModel((current) => ({
                  ...current,
                  flows: current.flows.filter((flow) => flow.id !== id),
                }));
                setSelectedFlowId(null);
              }}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

export default function App(): React.ReactNode {
  return (
    <ReactFlowProvider>
      <AppShell />
    </ReactFlowProvider>
  );
}
