import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  LoaderCircle,
  MessageSquareText,
  ShieldQuestion,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { buildInterviewDraft } from "../../interview/buildDraft.js";
import type { InterviewProfile, InterviewReview } from "../../shared/schemas.js";
import { reviewInterview } from "../lib/api.js";
import type { DraftPreview } from "./DraftReviewModal.js";

interface InterviewWizardProps {
  onClose: () => void;
  onDraft: (preview: DraftPreview) => void;
}

const initialProfile: InterviewProfile = {
  name: "",
  description: "",
  systemKind: "auto",
  businessCriticality: "high",
  primaryUsers: "Customers",
  internetExposed: true,
  sensitiveData: false,
  dataStores: "",
  externalSystems: "",
  usesAi: false,
  usesRag: false,
  usesAgents: false,
  agentTools: "",
  highImpactActions: false,
  authentication: true,
  encryption: true,
  auditLogging: false,
  humanApproval: false,
  additionalContext: "",
};

function ToggleField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): React.ReactNode {
  return (
    <label className="interview-toggle">
      <span>
        <strong>{label}</strong>
        <small>{help}</small>
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

export function InterviewWizard({ onClose, onDraft }: InterviewWizardProps): React.ReactNode {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<InterviewProfile>(initialProfile);
  const [review, setReview] = useState<InterviewReview | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patch = (value: Partial<InterviewProfile>) =>
    setProfile((current) => ({ ...current, ...value }));
  const stepLabels = ["Scope", "Data", "AI & agents", "Controls", "Review"];

  const requestReview = async (): Promise<void> => {
    setReviewing(true);
    setError(null);
    try {
      setReview(await reviewInterview(profile));
      setStep(4);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  const createDraft = (): void => {
    const draft = buildInterviewDraft(profile);
    onDraft({
      sourceLabel:
        review?.mode === "ai" ? "AI-assisted architecture interview" : "Architecture interview",
      model: draft.model,
      warnings: [...draft.warnings, ...(review?.warnings ?? [])],
      sourceCount: draft.model.nodes.length + draft.model.flows.length,
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal modal--interview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interview-title"
      >
        <header className="modal-header">
          <div className="modal-title">
            <span className="modal-icon modal-icon--ai">
              <MessageSquareText size={19} />
            </span>
            <div>
              <span className="eyebrow">Guided architecture discovery</span>
              <h2 id="interview-title">Architecture interviewer</h2>
            </div>
          </div>
          <button className="icon-button" type="button" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <nav className="interview-progress" aria-label="Interview progress">
          {stepLabels.map((label, index) => (
            <div className={index === step ? "active" : index < step ? "complete" : ""} key={label}>
              <span>{index < step ? <Check size={12} /> : index + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </nav>
        <div className="modal-content interview-content">
          {step === 0 ? (
            <div className="interview-step">
              <div className="step-heading">
                <h3>What are we modelling?</h3>
                <p>
                  Start with scope and users. Avoid credentials or confidential data in free text.
                </p>
              </div>
              <label className="field">
                <span>System name</span>
                <input
                  value={profile.name}
                  maxLength={120}
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Purpose and important outcomes</span>
                <textarea
                  rows={4}
                  value={profile.description}
                  onChange={(event) => patch({ description: event.target.value })}
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>Primary users</span>
                  <input
                    value={profile.primaryUsers}
                    onChange={(event) => patch({ primaryUsers: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Business criticality</span>
                  <select
                    value={profile.businessCriticality}
                    onChange={(event) =>
                      patch({
                        businessCriticality: event.target
                          .value as InterviewProfile["businessCriticality"],
                      })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="mission-critical">Mission critical</option>
                  </select>
                </label>
              </div>
              <ToggleField
                label="Internet exposed"
                help="Users or systems can reach an entry point from the internet."
                checked={profile.internetExposed}
                onChange={(value) => patch({ internetExposed: value })}
              />
            </div>
          ) : null}
          {step === 1 ? (
            <div className="interview-step">
              <div className="step-heading">
                <h3>Data and dependencies</h3>
                <p>
                  Identify stores and external trust boundaries. Names are sufficient at this stage.
                </p>
              </div>
              <ToggleField
                label="Processes sensitive data"
                help="Personal, financial, health, authentication or restricted business information."
                checked={profile.sensitiveData}
                onChange={(value) => patch({ sensitiveData: value })}
              />
              <label className="field">
                <span>Data stores</span>
                <textarea
                  rows={3}
                  placeholder="Customer database, object storage"
                  value={profile.dataStores}
                  onChange={(event) => patch({ dataStores: event.target.value })}
                />
                <small>Separate multiple entries with commas or new lines.</small>
              </label>
              <label className="field">
                <span>External systems and third parties</span>
                <textarea
                  rows={3}
                  placeholder="Identity provider, payment gateway"
                  value={profile.externalSystems}
                  onChange={(event) => patch({ externalSystems: event.target.value })}
                />
              </label>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="interview-step">
              <div className="step-heading">
                <h3>AI and autonomous behaviour</h3>
                <p>These answers activate ATLAS, MAESTRO and OWASP AI modelling.</p>
              </div>
              <ToggleField
                label="Uses a model or LLM"
                help="Hosted model API, local model or embedded AI capability."
                checked={profile.usesAi}
                onChange={(value) =>
                  patch({ usesAi: value, ...(value ? {} : { usesRag: false, usesAgents: false }) })
                }
              />
              <ToggleField
                label="Uses retrieval-augmented generation"
                help="Retrieves documents, embeddings or knowledge to ground model output."
                checked={profile.usesRag}
                onChange={(value) => patch({ usesRag: value, usesAi: value || profile.usesAi })}
              />
              <ToggleField
                label="Uses autonomous agents"
                help="Plans or invokes tools across multiple steps."
                checked={profile.usesAgents}
                onChange={(value) => patch({ usesAgents: value, usesAi: value || profile.usesAi })}
              />
              {profile.usesAgents ? (
                <>
                  <label className="field">
                    <span>Agent tools and downstream actions</span>
                    <textarea
                      rows={3}
                      placeholder="CRM search, email sender, refund API"
                      value={profile.agentTools}
                      onChange={(event) => patch({ agentTools: event.target.value })}
                    />
                  </label>
                  <ToggleField
                    label="Can perform high-impact actions"
                    help="Writes data, sends messages, executes code, moves money or changes access."
                    checked={profile.highImpactActions}
                    onChange={(value) => patch({ highImpactActions: value })}
                  />
                </>
              ) : null}
            </div>
          ) : null}
          {step === 3 ? (
            <div className="interview-step">
              <div className="step-heading">
                <h3>Control evidence</h3>
                <p>
                  Only enable a control if you have reasonable evidence. You can refine it later.
                </p>
              </div>
              <ToggleField
                label="Authentication enforced"
                help="Human and workload identities are authenticated at relevant boundaries."
                checked={profile.authentication}
                onChange={(value) => patch({ authentication: value })}
              />
              <ToggleField
                label="Encryption evidenced"
                help="Sensitive flows and persistent stores use managed encryption."
                checked={profile.encryption}
                onChange={(value) => patch({ encryption: value })}
              />
              <ToggleField
                label="Audit logging evidenced"
                help="Actors, model activity, tool actions and outcomes can be traced."
                checked={profile.auditLogging}
                onChange={(value) => patch({ auditLogging: value })}
              />
              {profile.usesAgents ? (
                <ToggleField
                  label="Human approval for consequential actions"
                  help="Approval is bound to a specific immutable action."
                  checked={profile.humanApproval}
                  onChange={(value) => patch({ humanApproval: value })}
                />
              ) : null}
              <label className="field">
                <span>Additional security context</span>
                <textarea
                  rows={3}
                  placeholder="Trust assumptions, regulatory scope, failure modes"
                  value={profile.additionalContext}
                  onChange={(event) => patch({ additionalContext: event.target.value })}
                />
              </label>
            </div>
          ) : null}
          {step === 4 && review ? (
            <div className="interview-step">
              <div className="step-heading step-heading--review">
                <span className="review-mode-pill">
                  {review.mode === "ai" ? <Sparkles size={14} /> : <ShieldQuestion size={14} />}
                  {review.mode === "ai" ? "AI evidence review" : "Deterministic evidence review"}
                </span>
                <h3>Questions to resolve before confirmation</h3>
                <p>{review.summary}</p>
              </div>
              <div className="interview-questions">
                {review.questions.map((question) => (
                  <article key={question.id}>
                    <span>{question.category}</span>
                    <h4>{question.question}</h4>
                    <p>{question.whyItMatters}</p>
                  </article>
                ))}
              </div>
              {review.warnings.map((warning) => (
                <p className="interview-warning" key={warning}>
                  {warning}
                </p>
              ))}
              <div className="review-notice">
                <Bot size={18} />
                <div>
                  <strong>The interviewer cannot approve its own suggestions</strong>
                  <p>
                    The generated diagram remains marked needs-review until a human confirms each
                    entity.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="modal-footer modal-footer--split">
          <button
            className="button button--ghost"
            type="button"
            disabled={step === 0 || reviewing}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft size={15} /> Back
          </button>
          {step < 3 ? (
            <button
              className="button button--primary"
              type="button"
              disabled={step === 0 && !profile.name.trim()}
              onClick={() => setStep((current) => current + 1)}
            >
              Continue <ArrowRight size={15} />
            </button>
          ) : step === 3 ? (
            <button
              className="button button--primary"
              type="button"
              disabled={reviewing || !profile.name.trim()}
              onClick={() => void requestReview()}
            >
              {reviewing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
              {reviewing ? "Reviewing" : "Review architecture"}
            </button>
          ) : (
            <button className="button button--primary" type="button" onClick={createDraft}>
              <Check size={16} /> Generate review draft
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
