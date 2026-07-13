# Argus self-threat model

This document models Argus itself. It is a starting point for deployment review, not a claim of complete security.

## Scope and assets

In scope: the React client, Hono API, deterministic engine, imported/exported models, generated reports, runtime configuration and optional intelligence adapters.

Important assets include confidential architecture details, threat findings, vulnerability applicability decisions, API availability, framework-mapping integrity and any configured NVD API key.

## Trust boundaries

- Browser/user input to the application.
- Imported JSON files to the client parser.
- Client analysis requests to the API.
- Runtime environment and reverse proxy to the Node process.
- API egress to NVD, CISA and FIRST when live intelligence is enabled.
- Downloaded reports from Argus to external storage and collaboration systems.

## Key threats and controls

| Threat | Scenario | Existing controls | Residual work |
| --- | --- | --- | --- |
| Malformed or oversized model | Crafted input exhausts parsing or reaches unsafe assumptions | Zod validation, node/flow limits, 1 MB API body limit | Add edge rate limiting for internet deployment |
| Stored browser script injection | Model labels or upstream text execute in the UI | React escaping, no HTML rendering, restrictive CSP | Add UI regression tests for hostile strings |
| Cross-origin API misuse | An untrusted origin invokes analysis or intelligence endpoints | Explicit CORS allowlist, fixed methods and headers | Add authentication before shared deployment |
| SSRF through intelligence | User input redirects server egress to an internal service | Fixed upstream base URLs and strict CVE regex | Enforce deployment egress allowlists and review redirect policy |
| Secret disclosure | NVD key or confidential model is logged, exported or committed | Environment configuration, generic API errors, `.env` ignored | Use secret manager and define report classification policy |
| Framework or rule tampering | A code change silently weakens or fabricates mappings | Deterministic rules, source rationale, tests, CI and CodeQL | Require protected branches and security review for rule changes |
| False certainty | Users treat a mapping as confirmed exploitability or compliance | Confidence, assumptions, evidence types and report warnings | Add formal review/acceptance workflow |
| Stale knowledge | Living frameworks change while mappings remain old | Explicit versions, Dependabot and documented update process | Automate source-diff notifications with human approval |
| Upstream intelligence outage | NVD, KEV or EPSS is slow, incomplete or unavailable | Per-request timeouts, partial errors, live mode off by default | Add bounded caching and service health metrics |
| Availability or denial of wallet | Repeated requests consume CPU or upstream quotas | Model size limits, bounded CVE count and request timeout | Add identity quotas and reverse-proxy rate limits |
| Multi-tenant data exposure | A shared deployment leaks one team's models to another | No server-side persistence in v0.1 | Do not add collaboration without a tenancy redesign |

## Security assumptions

- The host, container runtime and TLS termination are patched and administered securely.
- Users do not place secrets in free-text model fields.
- Browser extensions and the user's local device are outside Argus's control.
- External framework and intelligence sources can be unavailable or inaccurate.
- CI credentials and branch settings are managed through GitHub, outside this repository.

## Recommended deployment controls

Use authenticated access, TLS, an explicit origin allowlist, edge request limits, structured security logs, locked dependencies, image scanning, a restricted egress policy and protected default branches. Keep live intelligence disabled until its outbound-data implications are accepted.

Revisit this model whenever authentication, persistence, multi-tenancy, LLM integration, arbitrary URL ingestion or automated asset discovery is introduced.
