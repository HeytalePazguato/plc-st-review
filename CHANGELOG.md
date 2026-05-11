# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — next: 0.0.1

### Added

- Engine that parses two `.st` file revisions with the `tree-sitter-iec61131-3-st`
  grammar and builds per-revision symbol tables for POUs (with their input /
  output / in-out signatures), global variables, enums, timer instances, call
  sites, `CASE` statements, and timer PT assignments.
- Eight check categories: `SIGNATURE_CHANGED`, `CALL_SITE_OUTDATED`,
  `TYPE_MISMATCH`, `ENUM_VALUE_REMOVED`, `ENUM_VALUE_ADDED`,
  `TIMER_VALUE_CHANGED`, `CONSTANT_VALUE_CHANGED`, `COMMENT_ONLY`.
- CLI with `--base/--head`, `--files`, and `--gitlab --mr` modes; output
  formats `terminal` (ANSI when TTY), `markdown`, and `json`.
- Local-git diff platform via `simple-git` that loads file pairs from two refs.
- `.plc-st-review.yml` config loader: `disabled_checks`, `severity_overrides`,
  `ignore_paths`, `safety_critical_prefixes`, `reporting.fail_on_severity`,
  `reporting.comment_style`.
- GitLab MR integration via `@gitbeaker/rest`:
  - Fetches MR changes, filters to `.st` files, parses before/after revisions
    at the MR's base/head SHAs.
  - Posts findings as inline discussions with an HTML-comment marker for
    dedup. On re-run, updates discussions whose body changed, leaves
    identical ones alone, and resolves discussions whose findings no longer
    apply.
  - Falls back to a single summary comment above the inline cap (default 100
    findings) or when `reporting.comment_style: summary` is set.
  - Honors `GITLAB_TOKEN` / `CI_JOB_TOKEN`, `GITLAB_URL` / `CI_SERVER_URL`,
    and `GITLAB_PROJECT_ID` / `CI_PROJECT_ID` so the same image works for
    both gitlab.com and self-hosted instances.
- GitHub PR integration via `@octokit/rest`:
  - Fetches PR changed files, parses before/after revisions at the PR's
    base/head SHAs.
  - Posts findings as inline review comments (editable individually, unlike
    formal reviews). Re-runs edit changed bodies, leave identical ones
    alone, and delete review comments whose findings disappear.
  - Falls back to a single summary issue comment above the inline cap.
  - Composite Docker-based GitHub Action at `action/action.yml` that picks
    up PR context from the workflow environment.
  - `examples/github-workflow.yml` drop-in workflow.
- Ten additional check categories (18 total): `ARRAY_BOUNDS_CHANGED`,
  `STATE_UNHANDLED`, `UNREACHABLE_CODE`, `LOOP_BOUNDS_CHANGED`,
  `POU_DELETED`, `POU_RENAMED`, `METHOD_ADDED_TO_INTERFACE`,
  `INHERITANCE_CHANGED`, `PRAGMA_CHANGED`, `UNUSED_VAR_INTRODUCED`.
- `docs/writing-custom-checks.md`, `docs/tuning-severities.md`,
  `docs/gitlab-setup.md`, `docs/github-setup.md`.
- `Dockerfile` (multi-stage: build → slim runtime) for use in GitLab CI and
  other container-based pipelines.
- `examples/gitlab-ci.yml` drop-in job; `examples/demo/` round-trip fixtures.
- Vitest suite covering each check and platform module (72 tests total, 3 of
  which drive the real tree-sitter parser end-to-end).
- `patches/tree-sitter+0.25.0.patch` (auto-applied via `patch-package`)
  bumps the binding's C++ standard from C++17 to C++20 so it compiles
  against the V8 headers in Node 20+'s `node-gyp` cache.
- `npm run bootstrap` first-install script: installs without scripts, applies
  the C++20 patch, then rebuilds the two native dependencies in the correct
  order.

### Fixed

- Symbol extractor now correctly identifies user-defined types and system
  function blocks (TON / TOF / TP) declared as bare identifiers in the AST,
  not only as `elementary_type` nodes.
