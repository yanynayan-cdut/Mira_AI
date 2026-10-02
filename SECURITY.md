# Security Policy

## Reporting a vulnerability

Please do not open a public issue for an unpatched security vulnerability. Use GitHub's **Report a vulnerability** action on the repository's Security tab to submit a private report. Include the affected version or commit, impact, reproduction steps, and any suggested mitigation. Do not include real user data or active credentials in the report.

If private vulnerability reporting is unavailable, contact the repository owner through their GitHub profile and request a private security contact. Avoid sending exploit details to public discussions.

## Supported versions

Security fixes are made on the default branch. Older version tags are retained for source provenance and are not guaranteed to receive backports. Use the latest published release unless a release notice says otherwise.

## Credential hygiene

Never commit API keys, OAuth tokens, signing certificates, `.env` files, local databases, session data, or private workspace configuration. If a credential is exposed, revoke or rotate it first; removing it from a later commit does not remove it from Git history.
