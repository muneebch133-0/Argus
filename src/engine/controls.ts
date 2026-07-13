import type { Control } from "../shared/schemas.js";
import { controlRef } from "./frameworks.js";

const controls: Control[] = [
  {
    id: "ARGUS-IAM-001",
    title: "Authenticate every human and workload identity",
    objective: "Prevent anonymous or weakly authenticated access across trust boundaries.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Use standards-based OIDC/OAuth with phishing-resistant authentication for people.",
      "Use short-lived workload identity federation instead of static API keys.",
      "Validate issuer, audience, signature, nonce and token lifetime at every enforcement point.",
    ],
    verification: [
      "Attempt anonymous, expired, wrong-audience and replayed-token requests.",
      "Review identity-provider and application authentication logs for complete attribution.",
    ],
    references: [controlRef("IA-2", "Identification and authentication", "NIST")],
  },
  {
    id: "ARGUS-IAM-002",
    title: "Apply least privilege to users, agents and tools",
    objective: "Limit blast radius when an identity, model output or agent is compromised.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Bind tool permissions to the initiating user's authorised scope.",
      "Use separate identities for agents, tools and deployment environments.",
      "Deny destructive, administrative and cross-tenant operations by default.",
    ],
    verification: [
      "Enumerate effective permissions and test prohibited operations.",
      "Confirm an agent cannot inherit the platform's administrative identity.",
    ],
    references: [controlRef("AC-6", "Least privilege", "NIST")],
  },
  {
    id: "ARGUS-IAM-003",
    title: "Require approval for consequential actions",
    objective:
      "Keep irreversible, privileged or high-impact actions under accountable human control.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Classify tool operations by impact and require explicit approval for high-risk actions.",
      "Show the exact action, target, parameters and expected effect to the approver.",
      "Expire approvals and bind them to one immutable action request.",
    ],
    verification: [
      "Attempt to reuse, alter and bypass an approval token.",
      "Verify denied and approved actions are attributable in audit logs.",
    ],
    references: [controlRef("AC-5", "Separation of duties", "NIST")],
  },
  {
    id: "ARGUS-DATA-001",
    title: "Protect sensitive data in transit and at rest",
    objective: "Preserve confidentiality and integrity of system, model and business data.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Use authenticated TLS across every boundary and managed encryption for persistent stores.",
      "Keep credentials, personal data and proprietary model information out of prompts and logs unless required.",
      "Separate encryption keys by tenant and environment where practical.",
    ],
    verification: [
      "Inspect transport configuration and reject plaintext connections.",
      "Sample logs, traces and backups for unapproved sensitive data.",
    ],
    references: [controlRef("SC-8", "Transmission confidentiality and integrity", "NIST")],
  },
  {
    id: "ARGUS-DATA-002",
    title: "Enforce retrieval-time tenant and document authorisation",
    objective: "Prevent embeddings, memory and RAG retrieval from bypassing source permissions.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Carry tenant, owner, classification and ACL metadata into every chunk and embedding.",
      "Filter retrieval using the requesting identity before content reaches a model.",
      "Use separate indexes for strongly isolated tenants and verify deletion propagation.",
    ],
    verification: [
      "Run cross-user and cross-tenant retrieval tests with semantically similar queries.",
      "Delete a source record and confirm chunks, embeddings, caches and citations are removed.",
    ],
    references: [controlRef("AC-3", "Access enforcement", "NIST")],
  },
  {
    id: "ARGUS-AI-001",
    title: "Separate instructions from untrusted content",
    objective: "Reduce direct and indirect prompt injection through explicit trust boundaries.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Treat user input, retrieved documents, tool output and agent messages as untrusted data.",
      "Use structured messages and policy enforcement outside the model rather than relying on prompt wording.",
      "Strip or quarantine active content and instruction-like data where the business use permits.",
    ],
    verification: [
      "Evaluate direct, indirect, encoded, multilingual and multi-turn injection attempts.",
      "Confirm injected content cannot change tool policy or disclose higher-trust instructions.",
    ],
    references: [controlRef("SI-10", "Information input validation", "NIST")],
  },
  {
    id: "ARGUS-AI-002",
    title: "Validate model output before use",
    objective:
      "Prevent model-generated content from becoming executable commands, queries or trusted decisions.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Validate outputs against strict schemas and business invariants.",
      "Use parameterised APIs and queries; never concatenate model output into interpreters.",
      "Re-authorise every requested action at the target system.",
    ],
    verification: [
      "Fuzz structured outputs and inject shell, SQL, template and path traversal payloads.",
      "Confirm invalid output fails closed without invoking downstream tools.",
    ],
    references: [controlRef("V5", "Validation, sanitization and encoding", "OWASP ASVS")],
  },
  {
    id: "ARGUS-AI-003",
    title: "Establish RAG and dataset provenance",
    objective: "Prevent untrusted or tampered content from silently influencing AI behaviour.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Record source, author, ingestion time, checksum, classification and approval status.",
      "Quarantine external content and require validation before indexing or training.",
      "Display citations and source trust to users and downstream decision points.",
    ],
    verification: [
      "Insert malicious and conflicting source content and verify quarantine and attribution.",
      "Trace a generated answer back to exact source versions.",
    ],
    references: [controlRef("SR-4", "Provenance", "NIST")],
  },
  {
    id: "ARGUS-AI-004",
    title: "Protect agent memory integrity",
    objective:
      "Prevent persistent poisoning, cross-user leakage and unauthorised behavioural influence.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Scope memory by tenant, user, agent, purpose and session.",
      "Validate writes, preserve provenance and separate observations from instructions.",
      "Support review, expiry, correction and secure deletion of memory records.",
    ],
    verification: [
      "Attempt cross-tenant reads and persistent instruction injection.",
      "Confirm expired and deleted memories cannot be retrieved from indexes or caches.",
    ],
    references: [controlRef("SI-7", "Software, firmware and information integrity", "NIST")],
  },
  {
    id: "ARGUS-AI-005",
    title: "Verify model and AI supply-chain provenance",
    objective:
      "Reduce compromise through models, adapters, datasets, plugins and agent frameworks.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Pin model, dataset, container and dependency versions with approved sources and hashes.",
      "Scan model formats and load untrusted artifacts in isolated, non-privileged environments.",
      "Maintain an AI bill of materials with owners and update status.",
    ],
    verification: [
      "Verify signatures or hashes before model loading and deployment.",
      "Attempt to introduce an unapproved model or dependency through the release pipeline.",
    ],
    references: [controlRef("SR-3", "Supply chain controls and processes", "NIST")],
  },
  {
    id: "ARGUS-AI-006",
    title: "Continuously evaluate adversarial AI behaviour",
    objective: "Measure whether controls withstand relevant AI and agent attacks over time.",
    type: "detect",
    priority: "mandatory",
    implementation: [
      "Maintain versioned evaluations for prompt injection, leakage, poisoning, tool misuse and unsafe autonomy.",
      "Run evaluations before release and after model, prompt, tool, policy or data changes.",
      "Track attack success rate, false positives, cost and control regressions.",
    ],
    verification: [
      "Demonstrate failing controls block release according to documented thresholds.",
      "Reproduce evaluation results with fixed model and dataset versions.",
    ],
    references: [controlRef("CA-8", "Penetration testing", "NIST")],
  },
  {
    id: "ARGUS-AI-007",
    title: "Apply runtime policy and circuit breakers",
    objective: "Constrain non-deterministic behaviour at enforceable system boundaries.",
    type: "respond",
    priority: "mandatory",
    implementation: [
      "Enforce tool, data, identity, spend and action policies outside the model.",
      "Stop execution on repeated policy violations, unexpected tool sequences or confidence loss.",
      "Provide an operator kill switch that revokes agent credentials and active work.",
    ],
    verification: [
      "Trigger policy violations and verify execution stops before downstream impact.",
      "Exercise credential revocation and recovery during incident simulations.",
    ],
    references: [controlRef("D3-RAC", "Resource access control", "MITRE D3FEND")],
  },
  {
    id: "ARGUS-APP-001",
    title: "Validate inputs and enforce business invariants",
    objective: "Prevent malformed, unauthorised and semantically invalid operations.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Use allowlisted schemas, length limits and canonicalisation at every external interface.",
      "Enforce authorisation and business rules on the server, independently of clients and models.",
    ],
    verification: [
      "Fuzz APIs with malformed, oversized, duplicate and unauthorised requests.",
      "Test object-level and function-level authorisation for every role.",
    ],
    references: [controlRef("V5", "Validation, sanitization and encoding", "OWASP ASVS")],
  },
  {
    id: "ARGUS-APP-002",
    title: "Protect service availability and spend",
    objective: "Limit resource exhaustion, denial of service and denial-of-wallet attacks.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Apply per-identity, tenant, endpoint, model and tool quotas.",
      "Set token, recursion, timeout, concurrency and monetary budgets.",
      "Degrade safely and prevent retries from multiplying downstream load.",
    ],
    verification: [
      "Load test rate, concurrency, token and recursion limits.",
      "Simulate dependency failure and confirm bounded retries and safe degradation.",
    ],
    references: [controlRef("SC-5", "Denial-of-service protection", "NIST")],
  },
  {
    id: "ARGUS-OPS-001",
    title: "Create attributable, tamper-evident audit records",
    objective: "Support repudiation resistance, investigation and accountable AI operation.",
    type: "detect",
    priority: "mandatory",
    implementation: [
      "Record actor, workload identity, model, prompt/template version, retrieved sources, tool request, approval and outcome.",
      "Redact secrets and unnecessary personal data while retaining investigation value.",
      "Protect log integrity and synchronise time across components.",
    ],
    verification: [
      "Trace a user request through model, retrieval, agent and tool events.",
      "Attempt log modification and verify detection or immutability controls.",
    ],
    references: [controlRef("AU-3", "Content of audit records", "NIST")],
  },
  {
    id: "ARGUS-OPS-002",
    title: "Monitor AI and system security behaviour",
    objective: "Detect abuse, control bypass and abnormal agent execution early.",
    type: "detect",
    priority: "recommended",
    implementation: [
      "Alert on unusual tool sequences, privilege use, retrieval volume, memory writes and token spend.",
      "Correlate identity, application, model, data and tool telemetry using one trace identifier.",
      "Baseline expected agent actions and investigate material deviations.",
    ],
    verification: [
      "Replay representative attack paths and confirm alerts contain investigation context.",
      "Measure detection coverage and alert latency against the threat model.",
    ],
    references: [controlRef("SI-4", "System monitoring", "NIST")],
  },
  {
    id: "ARGUS-SUPPLY-001",
    title: "Harden software and infrastructure delivery",
    objective: "Prevent tampering and vulnerable components from entering production.",
    type: "prevent",
    priority: "mandatory",
    implementation: [
      "Generate SBOMs, scan code/dependencies/images/IaC and sign release artifacts.",
      "Use short-lived CI identities, protected branches and review requirements.",
      "Patch confirmed exploited vulnerabilities within risk-based service levels.",
    ],
    verification: [
      "Attempt deployment of an unsigned artifact and a known-vulnerable dependency.",
      "Verify provenance from source commit through production artifact.",
    ],
    references: [controlRef("SR-11", "Component authenticity", "NIST")],
  },
  {
    id: "ARGUS-GOV-001",
    title: "Maintain ownership, inventory and change governance",
    objective: "Keep the threat model and control decisions aligned with the deployed system.",
    type: "govern",
    priority: "mandatory",
    implementation: [
      "Assign owners for systems, models, datasets, agents, tools and high-risk controls.",
      "Review the threat model when architecture, identity, data, model, prompt or tool scope changes.",
      "Record accepted risks with rationale, compensating controls and expiry.",
    ],
    verification: [
      "Compare deployed components with the approved inventory and threat model.",
      "Sample exceptions for current owner, evidence, approval and expiry.",
    ],
    references: [controlRef("CM-8", "System component inventory", "NIST")],
  },
];

export const CONTROL_LIBRARY = new Map(controls.map((control) => [control.id, control]));

export function selectControls(ids: Iterable<string>): Control[] {
  return [...new Set(ids)]
    .map((id) => CONTROL_LIBRARY.get(id))
    .filter((control): control is Control => control !== undefined);
}
