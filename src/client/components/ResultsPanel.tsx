import { ChevronDown, ExternalLink, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { AnalysisResult, Severity, Threat } from "../../shared/schemas.js";

type ResultsTab = "findings" | "controls" | "evidence";

function SeverityBadge({
  severity,
  score,
}: {
  severity: Severity;
  score: number;
}): React.ReactNode {
  return (
    <span className={`severity severity--${severity}`}>
      {severity} · {score}
    </span>
  );
}

function ThreatCard({ threat }: { threat: Threat }): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={`threat-card threat-card--${threat.severity}`}>
      <button
        type="button"
        className="threat-card__summary"
        onClick={() => setExpanded((value) => !value)}
      >
        <div>
          <div className="threat-card__meta">
            <SeverityBadge severity={threat.severity} score={threat.riskScore} />
            <span>{threat.findingType.replaceAll("-", " ")}</span>
          </div>
          <h3>{threat.title}</h3>
          <p>{threat.scenario}</p>
        </div>
        <ChevronDown className={expanded ? "rotate" : ""} size={18} />
      </button>
      {expanded ? (
        <div className="threat-card__detail">
          <div className="detail-grid">
            <div>
              <span>Likelihood</span>
              <strong>{threat.likelihood}/5</strong>
            </div>
            <div>
              <span>Impact</span>
              <strong>{threat.impact}/5</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{threat.confidence}</strong>
            </div>
          </div>
          <section>
            <h4>Attack path</h4>
            <div className="attack-path">
              {threat.attackPath.map((step, index) => (
                <span key={`${threat.id}-${step}`}>
                  <b>{index + 1}</b>
                  {step}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h4>Framework mapping</h4>
            <div className="framework-list">
              {threat.frameworks.map((item) => (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  key={`${item.framework}-${item.id}`}
                >
                  <span>
                    <strong>{item.framework}</strong>
                    {item.id} · {item.name}
                  </span>
                  <ExternalLink size={13} />
                </a>
              ))}
            </div>
          </section>
          <section>
            <h4>Recommended control IDs</h4>
            <div className="chip-list">
              {threat.controlIds.map((id) => (
                <span key={id}>{id}</span>
              ))}
            </div>
          </section>
          {threat.assumptions.length > 0 ? (
            <section className="assumptions">
              <h4>Assumptions</h4>
              {threat.assumptions.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ResultsPanel({ result }: { result: AnalysisResult }): React.ReactNode {
  const [tab, setTab] = useState<ResultsTab>("findings");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const threats = useMemo(
    () =>
      result.threats.filter(
        (threat) =>
          (severity === "all" || threat.severity === severity) &&
          `${threat.title} ${threat.scenario} ${threat.category}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [result.threats, query, severity],
  );

  return (
    <div className="results-panel">
      <div className="results-hero">
        <div>
          <span className="eyebrow">{result.mode} analysis</span>
          <h2>{result.summary.total} threats identified</h2>
        </div>
        <div
          className="risk-orbit"
          style={{ "--risk": `${result.summary.highestRiskScore * 3.6}deg` } as React.CSSProperties}
        >
          <strong>{result.summary.highestRiskScore}</strong>
          <span>peak</span>
        </div>
      </div>
      <div className="summary-strip">
        <div>
          <span className="dot dot--critical" /> <strong>{result.summary.critical}</strong> Critical
        </div>
        <div>
          <span className="dot dot--high" /> <strong>{result.summary.high}</strong> High
        </div>
        <div>
          <span className="dot dot--medium" /> <strong>{result.summary.medium}</strong> Medium
        </div>
        <div>
          <ShieldCheck size={14} /> <strong>{result.summary.controlCount}</strong> Controls
        </div>
      </div>
      <div className="results-tabs" role="tablist">
        {(["findings", "controls", "evidence"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "findings" ? (
        <div className="results-content">
          <div className="result-filters">
            <label className="search-field">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search threats"
              />
            </label>
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as Severity | "all")}
            >
              <option value="all">All severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="threat-list">
            {threats.length > 0 ? (
              threats.map((threat) => <ThreatCard threat={threat} key={threat.id} />)
            ) : (
              <div className="empty-state">No threats match this filter.</div>
            )}
          </div>
        </div>
      ) : null}
      {tab === "controls" ? (
        <div className="results-content control-list">
          {result.controls.map((control) => (
            <article className="control-card" key={control.id}>
              <div className="control-card__heading">
                <span>{control.id}</span>
                <b>{control.priority}</b>
              </div>
              <h3>{control.title}</h3>
              <p>{control.objective}</p>
              <h4>Implementation</h4>
              <ul>
                {control.implementation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h4>Verification</h4>
              <ul>
                {control.verification.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
      {tab === "evidence" ? (
        <div className="results-content evidence-view">
          <div className="callout callout--warning">
            <TriangleAlert size={17} />
            <div>
              <strong>Interpretation boundary</strong>
              <p>
                Argus produces evidence-backed hypotheses for review. It does not prove
                exploitability or deployed control status.
              </p>
            </div>
          </div>
          <h3>Framework coverage</h3>
          <div className="coverage-list">
            {result.frameworkCoverage.map((item) => (
              <div key={item.framework}>
                <span>
                  <strong>{item.framework}</strong>
                  <small>{item.version}</small>
                </span>
                <b>{item.findingCount}</b>
              </div>
            ))}
          </div>
          <h3>Analysis warnings</h3>
          <ul className="warning-list">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <div className="analysis-id">
            <span>Analysis ID</span>
            <code>{result.analysisId}</code>
          </div>
        </div>
      ) : null}
    </div>
  );
}
