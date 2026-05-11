# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in plc-st-review, please report it
responsibly.

**Preferred channel:** open a private security advisory through GitHub:
[Report a vulnerability](https://github.com/HeytalePazguato/plc-st-review/security/advisories/new).

**Do NOT** open a public GitHub issue for security vulnerabilities.

You can expect an initial response within 7 days. Confirmed issues will be
fixed in the next release; the advisory will be published with credit (unless
you prefer to remain anonymous).

## Scope

`plc-st-review` parses Structured Text source files locally and (in later
phases) posts review comments to GitLab/GitHub. Reportable vulnerabilities
include: parser crashes triggered by crafted input, code injection via
configuration or argument values, and credential leakage through logs or
network calls. Out of scope: behavior of upstream tools (`tree-sitter`,
`tree-sitter-iec61131-3-st`, `simple-git`) — report those upstream.

## Supported Versions

Only the latest released minor version is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |
