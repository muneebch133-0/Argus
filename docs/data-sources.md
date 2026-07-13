# Data sources and evidence policy

Argus separates four kinds of information:

| Type | Meaning | Example |
| --- | --- | --- |
| Architecture fact | Supplied and validated in the model | A flow is unencrypted |
| Framework mapping | An applicable security taxonomy relationship | STRIDE information disclosure |
| Inference | A conclusion that still needs validation | A missing model attribute means a control is not evidenced |
| Vulnerability evidence | A sourced record with applicability checks | A deployed version is affected by a CVE and reachable |

## Framework sources

- [OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html) for STRIDE context.
- [MITRE ATT&CK](https://attack.mitre.org/) for enterprise adversary behaviour.
- [MITRE ATLAS](https://atlas.mitre.org/) and the [ATLAS data repository](https://github.com/mitre-atlas/atlas-data) for adversarial AI knowledge.
- [CSA MAESTRO](https://cloudsecurityalliance.org/blog/2025/02/06/agentic-ai-threat-modeling-framework-maestro) for agentic AI system layers.
- [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/) for LLM application risks.
- [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) for agentic application risks.
- [NIST AI 100-2 E2025](https://csrc.nist.gov/pubs/ai/100/2/e2025/final) for adversarial machine learning terminology and taxonomy.
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) and [MITRE D3FEND](https://d3fend.mitre.org/) for control context.

Versions are recorded in generated mappings. Some sources are living knowledge bases; maintainers must verify names and links when rules change.

## Vulnerability intelligence

When explicitly enabled, Argus queries:

- [NIST NVD CVE API](https://nvd.nist.gov/developers/vulnerabilities) for descriptions, CVSS, dates and CWE mappings;
- [CISA Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) for evidence of exploitation in the wild; and
- [FIRST EPSS](https://www.first.org/epss/api) for an estimate of exploitation probability.

Interpretation rules:

1. NVD presence proves that a CVE record exists, not that the modelled asset is affected.
2. Applicability requires product, version, configuration and platform verification.
3. Reachability and existing controls determine whether an applicable vulnerability is exploitable in context.
4. CISA KEV raises urgency because exploitation is known, but does not replace applicability checks.
5. EPSS estimates likelihood, not business impact or overall severity.
6. Conflicting or unavailable upstream data must be retained as an error or warning, never silently converted into certainty.

## AI incident and vulnerability records

Argus links to the [AI Vulnerability Database](https://docs.avidml.org/database/introduction) as an evidence source but does not automatically ingest records in v0.1. AI incident records may describe harms, failures or weaknesses that do not fit the conventional product/version/CVE model. Future ingestion must preserve the source's taxonomy and distinguish observed incidents from a vulnerability confirmed in the user's architecture.

## Updating sources

A source update requires a pull request that identifies the previous and new source versions, explains changed mappings, updates rule tests and runs the full verification suite. Avoid copying source text into the repository; store concise mappings, rationale and direct links.
