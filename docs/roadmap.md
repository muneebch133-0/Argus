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

## 0.2 — Evidence and rule operations

- Versioned external rule packs with signed releases.
- Framework/source update checks and mapping-diff review.
- Finding suppression, acceptance, owner, due date and review history in portable files.
- SARIF and CycloneDX-compatible output where semantics fit.
- Expanded positive and negative rule fixtures.

## 0.3 — Architecture ingestion

- OpenAPI, Terraform plan, Kubernetes and cloud inventory adapters.
- Diagram-as-code import with an explicit evidence-confidence model.
- SBOM/PURL inventory and applicability-aware CVE matching.
- Data-flow and trust-boundary suggestions that always require confirmation.

## 0.4 — Collaboration

- Authenticated projects, organisations and role-based access.
- Tenant isolation, encryption, audit records and retention controls.
- Review gates, comments and remediation integrations.
- A new threat model and external security review before release.

## 0.5 — Guarded AI assistance

- Optional model-assisted architecture interviews and scenario explanations.
- Structured outputs validated against deterministic schemas.
- Retrieval only from versioned, approved framework content.
- Provenance and clear separation between model suggestions and verified evidence.
- Evaluation suite for hallucinated IDs, prompt injection, data leakage and unsafe actions.

Roadmap items are proposals, not commitments. Open an issue with a concrete use case and security constraints before starting a large feature.
