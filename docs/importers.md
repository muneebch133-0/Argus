# Architecture importers

Argus converts declared infrastructure and API configuration into a review draft. Importing is evidence collection, not verification: source configuration can be incomplete, stale, templated or different from effective runtime state.

## Trust model

- Parsing runs in the browser and no imported source file is sent to the server.
- Files are limited to 2 MB and YAML aliases are bounded.
- Input is treated as data. Argus does not execute templates, commands, providers or referenced URLs.
- Every inferred component and flow is marked `needs-review` with source, locator, observation and confidence.
- The deterministic analysis API rejects a model while any generated entity remains unconfirmed.
- Importers never claim that a declared product is affected by a CVE.

## Formats and assumptions

### OpenAPI and Swagger

Argus supports OpenAPI 3.x and Swagger 2 documents in JSON or YAML. It creates an API component and an external caller, records documented operations and security declarations, and proposes the caller-to-API flow. A security scheme in the document is evidence that authentication is documented, not that every operation or deployment enforces it.

### Docker Compose

Argus creates components from `services`, records image, network, port, dependency and selected security declarations, and creates flows for explicit `depends_on` relationships. Published ports suggest external exposure. Compose dependencies do not necessarily represent every network flow.

### Kubernetes

Argus recognises Pods, Deployments, StatefulSets, DaemonSets, Jobs, CronJobs, Services, Ingresses and `List` documents. Service selectors are matched to imported workload labels. Ingress routes are matched to Services. TLS declarations, service types and container security contexts are retained as evidence, but effective admission policy, mesh identity, network policy and runtime mutation are outside a manifest-only import.

### Terraform plans

Argus reads Terraform plan JSON `planned_values` and creates supported resource components with type, location and public-access indicators. It does not infer data flows from Terraform references, and it does not run Terraform or providers. Unknown or sensitive values should already be redacted by the plan producer; reviewers must treat plan files as potentially confidential.

### MCP configurations

Argus recognises common JSON objects containing `mcpServers`. It creates MCP server components and identifies local command or remote transport declarations. Header and environment-variable names are inspected for credential indicators, but their values are never copied. Remote URL values are not retained, preventing embedded credentials or query parameters from entering the model. The importer does not start servers or connect to remote URLs.

### Native Argus models

Argus JSON models are parsed through the shared versioned schema. Their existing evidence and review states are preserved. Native models are not relabelled as generated evidence.

## Review workflow

1. Inspect import assumptions before applying a draft.
2. Select each component and flow and compare its fields with the displayed source locator.
3. Correct exposure, trust boundaries, identities, data classification and control attributes.
4. Mark reviewed entities confirmed, individually or with the whole-draft confirmation action.
5. Run threat analysis only after the evidence gate is clear.

Confirmation means a human reviewed the represented fact; it does not prove the deployment is secure.
