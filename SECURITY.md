# Security policy

## Supported versions

Argus is currently pre-1.0. Security fixes are applied to the latest commit on the default branch.

## Reporting a vulnerability

Do not open a public issue for a suspected security vulnerability.

Use GitHub's **Report a vulnerability** option under the repository's Security tab. Include:

- the affected version or commit;
- impact and realistic attack prerequisites;
- reproducible steps or a minimal proof of concept;
- any suggested remediation; and
- whether the report may be acknowledged publicly.

Please avoid accessing data that is not yours, disrupting services or using destructive payloads. Maintainers should acknowledge a complete report within five business days and coordinate disclosure after a fix is available.

## Deployment guidance

The repository provides secure defaults for a local single-user deployment, not a complete internet-facing identity or tenancy layer. Before broader deployment:

- place Argus behind authenticated access;
- terminate TLS at a maintained proxy or platform;
- set an explicit `ALLOWED_ORIGINS` value;
- keep live intelligence disabled unless outbound data handling is approved;
- store `NVD_API_KEY` only in a secret manager;
- add request-level rate limiting at the edge; and
- review [`docs/threat-model.md`](docs/threat-model.md).

Never place production credentials, customer data or confidential architecture details in public issues or sample models.
