import { Plus } from "lucide-react";
import { NODE_KIND_LABELS, type NODE_KINDS } from "../../shared/constants.js";
import type { ArchitectureNode } from "../../shared/schemas.js";

type NodeKind = (typeof NODE_KINDS)[number];

const groups: Array<{ label: string; kinds: NodeKind[] }> = [
  {
    label: "System",
    kinds: ["actor", "external-system", "application", "api", "service", "data-store"],
  },
  {
    label: "AI & data",
    kinds: [
      "foundation-model",
      "model-api",
      "rag-pipeline",
      "vector-store",
      "dataset",
      "model-registry",
    ],
  },
  { label: "Agentic", kinds: ["agent", "agent-orchestrator", "tool", "mcp-server", "memory"] },
  { label: "Assurance", kinds: ["guardrail", "human-approval", "observability"] },
];

export interface PaletteProps {
  onAdd: (kind: ArchitectureNode["kind"]) => void;
}

export function Palette({ onAdd }: PaletteProps): React.ReactNode {
  return (
    <aside className="palette" aria-label="Architecture components">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Component library</span>
          <h2>Build the model</h2>
        </div>
      </div>
      <p className="palette__hint">
        Add components, then drag between their connection handles to create data flows.
      </p>
      {groups.map((group) => (
        <section className="palette__group" key={group.label}>
          <h3>{group.label}</h3>
          <div className="palette__items">
            {group.kinds.map((kind) => (
              <button
                className="palette-button"
                type="button"
                key={kind}
                onClick={() => onAdd(kind)}
              >
                <span>{NODE_KIND_LABELS[kind]}</span>
                <Plus size={15} />
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="palette__privacy">
        <ShieldIcon />
        <div>
          <strong>Local-first by default</strong>
          <span>Models stay in your browser and Argus API unless you explicitly export them.</span>
        </div>
      </div>
    </aside>
  );
}

function ShieldIcon(): React.ReactNode {
  return (
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 20 6v5c0 5.2-3.4 8.4-8 10-4.6-1.6-8-4.8-8-10V6l8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
