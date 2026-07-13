# Rule authoring

Threat rules live in `src/engine/rules.ts`. A good rule converts an observable architecture condition into a falsifiable security hypothesis.

## Required fields

Every threat draft includes:

| Field | Requirement |
| --- | --- |
| `ruleId` | Stable, namespaced identifier; never recycle it for a different condition |
| `entityKey` | Stable node or flow identity used to derive the finding ID |
| `title` | Concise affected-component statement |
| `scenario` | Actor, action, weakness and consequence in plain language |
| `category` | Primary threat category |
| `findingType` | Design threat, AI threat, potential vulnerability or confirmed vulnerability |
| `likelihood` / `impact` | 1–5 baseline values justified by the rule condition |
| `confidence` | Strength of the evidence, separate from severity |
| affected IDs | Exact nodes and flows that produced the result |
| `frameworks` | Relevant mappings with source, version and rationale |
| `attackPath` | Ordered human-readable path from actor/input to impact |
| `controlIds` | Existing controls that mitigate the scenario |
| `assumptions` | Anything that must be verified outside the supplied model |

## Design rules

- Trigger only on schema-backed facts; do not search descriptions for security-sensitive decisions.
- Phrase missing attributes as **not evidenced**.
- Map a framework technique only when the scenario explains the relationship.
- Prefer one precise rule over a broad finding with many weak mappings.
- Do not add a CVE or claim confirmed exploitability from a product name.
- Keep control selection independent from presentation.
- Preserve stable IDs so teams can track accepted and remediated findings across runs.

## Testing

For each rule, add at least:

1. a minimal architecture that triggers it;
2. a near-identical architecture where the relevant control or condition prevents it;
3. assertions for affected entity IDs, category and control mappings; and
4. deterministic-ID and risk-bound assertions where relevant.

Integration tests should validate API rejection of malformed models and safe behaviour when optional intelligence sources fail.

## Adding controls

Controls live in `src/engine/controls.ts`. Controls should describe a reusable outcome rather than a vendor product. Provide concrete implementation guidance and at least one verification procedure that a reviewer can execute. Every referenced control ID in a rule must exist in the control library.

## Review checklist

- Is the trigger observable and unambiguous?
- Is the scenario materially different from existing rules?
- Does severity come from likelihood and impact rather than framework importance?
- Are confidence and assumptions honest about missing evidence?
- Do the source links point to primary or authoritative material?
- Can the recommended controls be tested?
- Do positive and negative tests pass with `npm run check`?
