import { AlertTriangle, Check, FileSearch, ShieldQuestion, X } from "lucide-react";
import type { SystemModel } from "../../shared/schemas.js";

export interface DraftPreview {
  sourceLabel: string;
  model: SystemModel;
  warnings: string[];
  sourceCount: number;
}

interface DraftReviewModalProps {
  preview: DraftPreview;
  onApply: () => void;
  onCancel: () => void;
}

export function DraftReviewModal({
  preview,
  onApply,
  onCancel,
}: DraftReviewModalProps): React.ReactNode {
  const reviewCount =
    preview.model.nodes.filter((node) => node.reviewStatus === "needs-review").length +
    preview.model.flows.filter((flow) => flow.reviewStatus === "needs-review").length;
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal modal--review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-title"
      >
        <header className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">
              <FileSearch size={19} />
            </span>
            <div>
              <span className="eyebrow">Evidence-gated import</span>
              <h2 id="draft-title">Review generated architecture</h2>
            </div>
          </div>
          <button className="icon-button" type="button" title="Close" onClick={onCancel}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-content">
          <div className="draft-summary-grid">
            <div>
              <span>Source</span>
              <strong>{preview.sourceLabel}</strong>
            </div>
            <div>
              <span>Observed objects</span>
              <strong>{preview.sourceCount}</strong>
            </div>
            <div>
              <span>Components</span>
              <strong>{preview.model.nodes.length}</strong>
            </div>
            <div>
              <span>Flows</span>
              <strong>{preview.model.flows.length}</strong>
            </div>
          </div>
          <div className="review-notice">
            <ShieldQuestion size={18} />
            <div>
              <strong>{reviewCount} generated entities require confirmation</strong>
              <p>
                Applying this draft does not convert suggestions into facts. Select each component
                or flow, review its source evidence and mark it confirmed.
              </p>
            </div>
          </div>
          {preview.warnings.length > 0 ? (
            <div className="draft-warnings">
              <h3>
                <AlertTriangle size={16} /> Import assumptions
              </h3>
              <ul>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="draft-entities">
            <h3>Proposed components</h3>
            <div className="draft-entity-list">
              {preview.model.nodes.slice(0, 12).map((node) => (
                <div key={node.id}>
                  <span>{node.kind.replaceAll("-", " ")}</span>
                  <strong>{node.name}</strong>
                  <small>{node.evidence[0]?.locator ?? "No source locator"}</small>
                </div>
              ))}
              {preview.model.nodes.length > 12 ? (
                <div className="draft-entity-more">
                  <strong>+{preview.model.nodes.length - 12} more</strong>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <button className="button button--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button button--primary" type="button" onClick={onApply}>
            <Check size={16} /> Apply as review draft
          </button>
        </footer>
      </section>
    </div>
  );
}
