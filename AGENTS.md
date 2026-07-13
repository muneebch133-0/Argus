# Argus contributor guidance

- Keep the threat engine deterministic. LLM output may explain a result but must never invent framework IDs, vulnerabilities, evidence, or control mappings.
- Every rule must include tests for both triggering and non-triggering architecture models.
- Keep evidence type, confidence, applicability, and source URL explicit.
- Do not label a product as vulnerable from a name match alone. A CVE becomes confirmed only after version/applicability verification.
- Treat imported architecture data as untrusted input. Do not fetch user-provided URLs from the server.
- Run `npm run check` before proposing a change.
