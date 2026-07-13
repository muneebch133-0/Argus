# Contributing to Argus

Thank you for helping make threat modelling more useful and defensible.

## Development setup

```bash
npm ci
npm run dev
```

Before opening a pull request:

```bash
npm run check
```

## Contribution principles

- Keep the analysis engine deterministic and reviewable.
- Cite a primary framework or authoritative source for every knowledge mapping.
- Separate architecture facts, inferences and externally confirmed evidence.
- Never label a component vulnerable from a product-name or CVE-string match alone.
- Describe controls as testable outcomes, with implementation and verification guidance.
- Avoid collecting model data or making outbound requests without explicit user action.

## Adding a threat rule

Read [`docs/rule-authoring.md`](docs/rule-authoring.md). Every rule change must include:

- a stable namespaced rule ID;
- a precise trigger based on schema fields;
- affected nodes and flows;
- a realistic threat scenario and attack path;
- confidence, assumptions and relevant framework references;
- one or more control IDs; and
- tests showing when the rule does and does not trigger.

## Pull requests

Keep changes focused. Explain the threat-model impact, list source updates and include screenshots for meaningful UI changes. Do not include generated `dist/`, local `.env` files, credentials or private threat models.
