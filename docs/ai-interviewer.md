# Guarded AI interviewer

The architecture interview is an elicitation aid. It does not produce threat findings, framework mappings, CVE claims or confirmed controls.

## Operating modes

`ARGUS_AI_PROVIDER=disabled` is the default. The Node API returns deterministic follow-up questions and the product remains fully usable without the Python service.

When `ARGUS_AI_PROVIDER=openai`, the isolated FastAPI service sends a bounded, schema-validated interview profile to the configured OpenAI model using the [Responses API and structured output](https://developers.openai.com/api/docs/guides/structured-outputs). The response must match a strict Pydantic schema containing a summary, no more than three questions and warnings. A missing key, timeout, provider error, refusal or invalid response returns the deterministic review instead.

## Data boundary

The optional request contains the interview fields shown in the UI: system name and description, exposure, user and data summaries, AI/RAG/agent flags, tool names, impact flags and reported high-level controls. It does not include:

- imported OpenAPI, Compose, Kubernetes, Terraform or MCP source files;
- the generated architecture graph;
- threat findings or vulnerability enrichment;
- browser local storage; or
- credentials intentionally supplied by Argus.

Do not place secrets, personal data or confidential prompt content in free-text interview answers. Enabling a hosted provider is an explicit deployment data-processing decision.

## Guardrails

- The interview profile is labelled untrusted data in the system instruction.
- Model tool use is not enabled.
- Provider-side response storage is disabled in the request.
- Output fields, lengths, categories and question count are validated.
- The Node API validates the Python service response again.
- AI-generated questions cannot modify or confirm the architecture.
- Draft entities built from interview answers remain `needs-review`.
- The deterministic engine alone creates threats, identifiers, scores and controls.

These controls reduce risk; they do not make model output trusted.

## Configuration

Docker Compose connects the Node and Python services on the internal Compose network and protects the internal endpoint with a shared token. The Python port is not published.

| Variable | Service | Purpose |
| --- | --- | --- |
| `ARGUS_AI_SERVICE_URL` | Node | Fixed internal Python service URL |
| `ARGUS_AI_SERVICE_TOKEN` | Node | Token sent only to the internal service |
| `ARGUS_INTERNAL_TOKEN` | Python | Expected internal request token |
| `ARGUS_AI_PROVIDER` | Python | `disabled` or `openai` |
| `ARGUS_AI_MODEL` | Python | Administratively selected model name |
| `OPENAI_API_KEY` | Python | Provider credential; keep it in a secret manager |

For a non-Compose deployment, expose the Python service only on a private service network, set matching high-entropy internal tokens, restrict egress, and keep the provider key out of the Node process and browser.

## Security evaluation cases

Changes to the AI path should test prompt-injection text inside every free-text field, attempts to elicit secrets or tool use, fabricated framework/CVE identifiers, oversized output, invalid categories, provider timeouts and malformed responses. The expected safe result is a validated question set or deterministic fallback—never partially trusted model output.
