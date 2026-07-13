import { Trash2 } from "lucide-react";
import { cloneElement, useId } from "react";
import { NODE_KIND_LABELS, NODE_KINDS, SYSTEM_KINDS } from "../../shared/constants.js";
import type { ArchitectureNode, DataFlow, SystemModel } from "../../shared/schemas.js";

interface InspectorProps {
  model: SystemModel;
  selectedNode?: ArchitectureNode;
  selectedFlow?: DataFlow;
  onModelChange: (patch: Partial<SystemModel>) => void;
  onNodeChange: (id: string, patch: Partial<ArchitectureNode>) => void;
  onFlowChange: (id: string, patch: Partial<DataFlow>) => void;
  onDeleteNode: (id: string) => void;
  onDeleteFlow: (id: string) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ id?: string }>;
}): React.ReactNode {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {cloneElement(children, { id })}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: string;
}): React.ReactNode {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {help ? <small>{help}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-control" aria-hidden="true" />
    </label>
  );
}

function NodeInspector({
  node,
  onChange,
  onDelete,
}: {
  node: ArchitectureNode;
  onChange: (patch: Partial<ArchitectureNode>) => void;
  onDelete: () => void;
}): React.ReactNode {
  const setAttribute = (key: string, value: string | boolean | string[]) =>
    onChange({ attributes: { ...node.attributes, [key]: value } });
  const attribute = (key: string): boolean => node.attributes[key] === true;
  const aiComponent = ![
    "actor",
    "external-system",
    "application",
    "api",
    "service",
    "data-store",
  ].includes(node.kind);
  const toolComponent = ["agent", "agent-orchestrator", "tool", "mcp-server"].includes(node.kind);
  const dataComponent = [
    "data-store",
    "vector-store",
    "memory",
    "dataset",
    "rag-pipeline",
  ].includes(node.kind);

  return (
    <div className="inspector-body">
      <div className="panel-heading panel-heading--bordered">
        <div>
          <span className="eyebrow">Selected component</span>
          <h2>{node.name}</h2>
        </div>
        <button
          className="icon-button icon-button--danger"
          type="button"
          title="Delete component"
          onClick={onDelete}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <div className="form-stack">
        <Field label="Name">
          <input value={node.name} onChange={(event) => onChange({ name: event.target.value })} />
        </Field>
        <Field label="Component type">
          <select
            value={node.kind}
            onChange={(event) => onChange({ kind: event.target.value as ArchitectureNode["kind"] })}
          >
            {NODE_KINDS.map((kind) => (
              <option value={kind} key={kind}>
                {NODE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea
            rows={3}
            value={node.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </Field>
        <div className="field-grid">
          <Field label="Trust zone">
            <input
              value={node.trustZone}
              onChange={(event) => onChange({ trustZone: event.target.value })}
            />
          </Field>
          <Field label="Exposure">
            <select
              value={node.exposure}
              onChange={(event) =>
                onChange({ exposure: event.target.value as ArchitectureNode["exposure"] })
              }
            >
              <option value="internal">Internal</option>
              <option value="partner">Partner</option>
              <option value="internet">Internet</option>
            </select>
          </Field>
        </div>
        <Field label="Data classification">
          <select
            value={node.dataClassification}
            onChange={(event) =>
              onChange({
                dataClassification: event.target.value as ArchitectureNode["dataClassification"],
              })
            }
          >
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
          </select>
        </Field>
        <div className="section-label">Control evidence</div>
        <Toggle
          label="Audit logging"
          checked={attribute("auditLogging")}
          onChange={(value) => setAttribute("auditLogging", value)}
        />
        <Toggle
          label="Rate and resource limits"
          checked={attribute("rateLimited")}
          onChange={(value) => setAttribute("rateLimited", value)}
        />
        <Toggle
          label="Input validation"
          checked={attribute("inputValidation")}
          onChange={(value) => setAttribute("inputValidation", value)}
        />
        {dataComponent ? (
          <Toggle
            label="Encrypted at rest"
            checked={attribute("encryptedAtRest")}
            onChange={(value) => setAttribute("encryptedAtRest", value)}
          />
        ) : null}
        {node.kind === "vector-store" ? (
          <Toggle
            label="Tenant-isolated retrieval"
            checked={attribute("tenantIsolation")}
            onChange={(value) => setAttribute("tenantIsolation", value)}
          />
        ) : null}
        {["dataset", "rag-pipeline", "memory"].includes(node.kind) ? (
          <Toggle
            label="Provenance verified"
            checked={attribute("provenanceVerified")}
            onChange={(value) => setAttribute("provenanceVerified", value)}
          />
        ) : null}
        {aiComponent ? (
          <>
            <Toggle
              label="Instruction/data separation"
              checked={attribute("instructionDataSeparation")}
              onChange={(value) => setAttribute("instructionDataSeparation", value)}
            />
            <Toggle
              label="Adversarially evaluated"
              checked={attribute("promptInjectionTested")}
              onChange={(value) => setAttribute("promptInjectionTested", value)}
            />
          </>
        ) : null}
        {["foundation-model", "model-api"].includes(node.kind) ? (
          <>
            <Toggle
              label="Model provenance verified"
              checked={attribute("modelProvenanceVerified")}
              onChange={(value) => setAttribute("modelProvenanceVerified", value)}
            />
            <Toggle
              label="Model extraction monitoring"
              checked={attribute("extractionMonitoring")}
              onChange={(value) => setAttribute("extractionMonitoring", value)}
            />
            <Toggle
              label="Trained on sensitive data"
              checked={attribute("trainedOnSensitiveData")}
              onChange={(value) => setAttribute("trainedOnSensitiveData", value)}
            />
            <Toggle
              label="Privacy attacks evaluated"
              checked={attribute("privacyEvaluated")}
              onChange={(value) => setAttribute("privacyEvaluated", value)}
            />
          </>
        ) : null}
        {toolComponent ? (
          <>
            <Toggle
              label="Writes data"
              checked={attribute("writesData")}
              onChange={(value) => setAttribute("writesData", value)}
            />
            <Toggle
              label="High-impact actions"
              checked={attribute("highImpact")}
              onChange={(value) => setAttribute("highImpact", value)}
            />
            <Toggle
              label="Executes code"
              checked={attribute("executesCode")}
              onChange={(value) => setAttribute("executesCode", value)}
            />
            <Toggle
              label="Model output validated"
              checked={attribute("modelOutputValidated")}
              onChange={(value) => setAttribute("modelOutputValidated", value)}
            />
          </>
        ) : null}
        {["agent", "agent-orchestrator"].includes(node.kind) ? (
          <>
            <Toggle
              label="Circuit breaker"
              checked={attribute("circuitBreaker")}
              onChange={(value) => setAttribute("circuitBreaker", value)}
            />
            <Toggle
              label="Dynamic agent creation"
              checked={attribute("dynamicAgentCreation")}
              onChange={(value) => setAttribute("dynamicAgentCreation", value)}
            />
            <Toggle
              label="Agent registry enforced"
              checked={attribute("agentRegistryEnforced")}
              onChange={(value) => setAttribute("agentRegistryEnforced", value)}
            />
          </>
        ) : null}
        <Field label="Candidate CVE IDs">
          <input
            placeholder="CVE-2025-1234, CVE-2026-5678"
            value={Array.isArray(node.attributes.cveIds) ? node.attributes.cveIds.join(", ") : ""}
            onChange={(event) =>
              setAttribute(
                "cveIds",
                event.target.value
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              )
            }
          />
        </Field>
      </div>
    </div>
  );
}

function FlowInspector({
  flow,
  model,
  onChange,
  onDelete,
}: {
  flow: DataFlow;
  model: SystemModel;
  onChange: (patch: Partial<DataFlow>) => void;
  onDelete: () => void;
}): React.ReactNode {
  const source = model.nodes.find((node) => node.id === flow.source)?.name ?? flow.source;
  const target = model.nodes.find((node) => node.id === flow.target)?.name ?? flow.target;
  return (
    <div className="inspector-body">
      <div className="panel-heading panel-heading--bordered">
        <div>
          <span className="eyebrow">Selected data flow</span>
          <h2>
            {source} → {target}
          </h2>
        </div>
        <button
          className="icon-button icon-button--danger"
          type="button"
          title="Delete flow"
          onClick={onDelete}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <div className="form-stack">
        <Field label="Flow label">
          <input value={flow.label} onChange={(event) => onChange({ label: event.target.value })} />
        </Field>
        <Field label="Protocol">
          <input
            value={flow.protocol}
            onChange={(event) => onChange({ protocol: event.target.value })}
          />
        </Field>
        <div className="section-label">Security properties</div>
        <Toggle
          label="Authenticated"
          checked={flow.authenticated}
          onChange={(value) => onChange({ authenticated: value })}
        />
        <Toggle
          label="Encrypted"
          checked={flow.encrypted}
          onChange={(value) => onChange({ encrypted: value })}
        />
        <Toggle
          label="Crosses trust boundary"
          checked={flow.crossesTrustBoundary}
          onChange={(value) => onChange({ crossesTrustBoundary: value })}
        />
        <Toggle
          label="Carries sensitive data"
          checked={flow.carriesSensitiveData}
          onChange={(value) => onChange({ carriesSensitiveData: value })}
        />
        <Toggle
          label="Carries untrusted content"
          checked={flow.untrustedContent}
          onChange={(value) => onChange({ untrustedContent: value })}
        />
      </div>
    </div>
  );
}

function SystemInspector({
  model,
  onChange,
}: {
  model: SystemModel;
  onChange: (patch: Partial<SystemModel>) => void;
}): React.ReactNode {
  return (
    <div className="inspector-body">
      <div className="panel-heading panel-heading--bordered">
        <div>
          <span className="eyebrow">Architecture scope</span>
          <h2>Model settings</h2>
        </div>
      </div>
      <div className="form-stack">
        <Field label="System name">
          <input value={model.name} onChange={(event) => onChange({ name: event.target.value })} />
        </Field>
        <Field label="Description">
          <textarea
            rows={4}
            value={model.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </Field>
        <Field label="Analysis mode">
          <select
            value={model.systemKind}
            onChange={(event) =>
              onChange({ systemKind: event.target.value as SystemModel["systemKind"] })
            }
          >
            {SYSTEM_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === "auto" ? "Auto-detect" : kind}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Business criticality">
          <select
            value={model.businessCriticality}
            onChange={(event) =>
              onChange({
                businessCriticality: event.target.value as SystemModel["businessCriticality"],
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="mission-critical">Mission critical</option>
          </select>
        </Field>
        <div className="model-stats">
          <div>
            <strong>{model.nodes.length}</strong>
            <span>Components</span>
          </div>
          <div>
            <strong>{model.flows.length}</strong>
            <span>Data flows</span>
          </div>
          <div>
            <strong>{new Set(model.nodes.map((node) => node.trustZone)).size}</strong>
            <span>Trust zones</span>
          </div>
        </div>
        <div className="callout">
          <strong>Evidence convention</strong>
          <p>
            An unchecked control means “not evidenced in this model.” Argus does not claim the
            deployed system definitely lacks it.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Inspector(props: InspectorProps): React.ReactNode {
  if (props.selectedNode) {
    return (
      <NodeInspector
        node={props.selectedNode}
        onChange={(patch) => props.onNodeChange(props.selectedNode?.id ?? "", patch)}
        onDelete={() => props.onDeleteNode(props.selectedNode?.id ?? "")}
      />
    );
  }
  if (props.selectedFlow) {
    return (
      <FlowInspector
        flow={props.selectedFlow}
        model={props.model}
        onChange={(patch) => props.onFlowChange(props.selectedFlow?.id ?? "", patch)}
        onDelete={() => props.onDeleteFlow(props.selectedFlow?.id ?? "")}
      />
    );
  }
  return <SystemInspector model={props.model} onChange={props.onModelChange} />;
}
