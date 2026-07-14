# Roadmap

The roadmap favours trustworthy evidence and review workflows over adding a large number of shallow framework labels.

## 0.1 — End-to-end local MVP

- Interactive architecture canvas and property inspector.
- Standard, AI and agentic component vocabulary.
- Deterministic STRIDE and AI threat rules.
- Framework mappings, risk scores, attack paths and testable controls.
- JSON import/export and Markdown reports.
- Optional NVD, CISA KEV and FIRST EPSS enrichment.
- Tests, hardened container, CI, CodeQL and source documentation.

## 0.2 — Evidence-gated discovery and interviews

- Browser-local OpenAPI, Docker Compose, Kubernetes, Terraform plan and MCP importers.
- Source provenance and review state on every generated component and flow.
- Human confirmation gate enforced in both the client and analysis API.
- Guided architecture interview for standard, AI, RAG and agentic systems.
- Optional isolated Python assistant with structured output and deterministic fallback.
- AI-service tests, container hardening, Python CI and CodeQL coverage.

## 0.3 — Evidence and rule operations

- Versioned external rule packs with signed releases.
- Framework/source update checks and mapping-diff review.
- Finding suppression, acceptance, owner, due date and review history in portable files.
- SARIF and CycloneDX-compatible output where semantics fit.
- Expanded positive and negative rule fixtures.

## 0.4 — Live inventory and applicability

- Read-only cloud inventory adapters with narrow, documented permissions.
- Diagram-as-code round trips and source-diff review.
- SBOM/PURL inventory and applicability-aware CVE matching.
- Runtime evidence reconciliation without silently overwriting reviewer decisions.

## 0.5 — Collaboration

- Authenticated projects, organisations and role-based access.
- Tenant isolation, encryption, audit records and retention controls.
- Review gates, comments and remediation integrations.
- A new threat model and external security review before release.

## 0.6 — Guarded AI explanation and evaluation

- Optional explanations grounded only in the exact deterministic result and approved sources.
- Retrieval only from versioned, approved framework content.
- Citations and clear separation between model wording and verified engine evidence.
- Expanded evaluation suite for hallucinated IDs, prompt injection, data leakage and unsafe actions.
- No autonomous remediation or deployment mutation.

Roadmap items are proposals, not commitments. Open an issue with a concrete use case and security constraints before starting a large feature.
