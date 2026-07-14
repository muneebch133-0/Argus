# Argus self-threat model

This document models Argus itself. It is a starting point for deployment review, not a claim of complete security.

## Scope and assets

In scope: the React client, browser-local importers, guided interview, Hono API, deterministic engine, optional Python interviewer, imported/exported models, generated reports, runtime configuration and optional intelligence adapters.

Important assets include confidential architecture details, interview answers, source-evidence integrity, threat findings, vulnerability applicability decisions, API availability, framework-mapping integrity and configured provider or NVD API keys.

## Trust boundaries

- Browser/user input to the application.
- Imported OpenAPI, Compose, Kubernetes, Terraform, MCP and Argus files to browser parsers.
- Client analysis requests to the API.
- Client interview profiles to the Node API.
- Node API to the internal Python service.
- Python service egress to a configured model provider when explicitly enabled.
- Runtime environment and reverse proxy to the Node process.
- API egress to NVD, CISA and FIRST when live intelligence is enabled.
- Downloaded reports from Argus to external storage and collaboration systems.

## Key threats and controls

| Threat | Scenario | Existing controls | Residual work |
| --- | --- | --- | --- |
| Malformed or oversized model | Crafted input exhausts parsing or reaches unsafe assumptions | Zod validation, node/flow limits, 1 MB API body limit | Add edge rate limiting for internet deployment |
| Malformed or hostile discovery file | YAML aliases, large files or crafted object shapes exhaust the browser or confuse an importer | 2 MB local limit, bounded YAML aliases, defensive shape checks, no template execution or URL fetch | Add a browser performance corpus and property-based parser tests |
| False imported evidence | A stale or deceptive file causes inferred entities to be treated as runtime truth | Per-entity source locators, `needs-review` state, visible badges, client and API analysis gate | Add signed source snapshots and reviewer identity in a future project store |
| Stored browser script injection | Model labels or upstream text execute in the UI | React escaping, no HTML rendering, restrictive CSP | Add UI regression tests for hostile strings |
| Cross-origin API misuse | An untrusted origin invokes analysis or intelligence endpoints | Explicit CORS allowlist, fixed methods and headers | Add authentication before shared deployment |
| SSRF through intelligence | User input redirects server egress to an internal service | Fixed upstream base URLs and strict CVE regex | Enforce deployment egress allowlists and review redirect policy |
| Secret disclosure | NVD key or confidential model is logged, exported or committed | Environment configuration, generic API errors, `.env` ignored | Use secret manager and define report classification policy |
| Framework or rule tampering | A code change silently weakens or fabricates mappings | Deterministic rules, source rationale, tests, CI and CodeQL | Require protected branches and security review for rule changes |
| False certainty | Users treat a mapping as confirmed exploitability or compliance | Confidence, assumptions, evidence types and report warnings | Add formal review/acceptance workflow |
| Stale knowledge | Living frameworks change while mappings remain old | Explicit versions, Dependabot and documented update process | Automate source-diff notifications with human approval |
| Upstream intelligence outage | NVD, KEV or EPSS is slow, incomplete or unavailable | Per-request timeouts, partial errors, live mode off by default | Add bounded caching and service health metrics |
| Interview prompt injection | Untrusted profile text instructs a model to fabricate findings, reveal data or bypass policy | Profile is labelled untrusted, no model tools, strict output schema, three-question limit, double validation | Maintain adversarial evaluation fixtures across model changes |
| AI data disclosure | Confidential interview content is sent to or retained by an external provider | Provider disabled by default, bounded profile only, request storage disabled, imported files excluded | Complete provider/legal review and minimise free-text before enablement |
| Internal interviewer spoofing | An attacker calls the private service or substitutes a response | Unpublished service port, shared internal token, fixed server URL, schema validation | Use workload identity or mTLS in orchestrated deployments |
| Model-provider outage or unsafe output | The provider times out, refuses or returns invalid content | Short timeout, exception isolation and deterministic fallback | Add provider health metrics without logging profile content |
| Availability or denial of wallet | Repeated requests consume CPU or upstream quotas | Model size limits, bounded CVE count and request timeout | Add identity quotas and reverse-proxy rate limits |
| Multi-tenant data exposure | A shared deployment leaks one team's models to another | No server-side persistence in v0.2 | Do not add collaboration without a tenancy redesign |

## Security assumptions

- The host, container runtime and TLS termination are patched and administered securely.
- Users do not place secrets in free-text model fields.
- Interview answers and infrastructure plans are classified before use.
- Browser extensions and the user's local device are outside Argus's control.
- External framework and intelligence sources can be unavailable or inaccurate.
- A configured AI provider can process the bounded profile according to the deployer's agreement and settings.
- CI credentials and branch settings are managed through GitHub, outside this repository.

## Recommended deployment controls

Use authenticated access, TLS, an explicit origin allowlist, edge request limits, structured security logs, locked dependencies, image scanning, a restricted egress policy and protected default branches. Keep live intelligence and the AI provider disabled until their outbound-data implications are accepted. Never expose the Python interviewer directly to browsers or the public internet.

Revisit this model whenever authentication, persistence, multi-tenancy, a new AI capability, arbitrary URL ingestion, live cloud access or automated asset discovery is introduced.
