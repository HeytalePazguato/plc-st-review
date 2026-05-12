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
- `childrenOf()` now prefers tree-sitter `namedChildren`, so anonymous tokens
  (`FOR`, `TO`, `:=`, `;`, ...) no longer pollute positional indexing in
  collectors like `collectForLoops` and `collectDivisions`.
- `collectTypeDecl` searches inside the `type_definition` child of
  `type_declaration` for the identifier — enums are now picked up by the
  real parser.
- GitHub and GitLab snapshot loaders walk the full repo tree at base/head
  SHAs rather than only the diffed files, so cross-file checks
  (`CALL_SITE_OUTDATED`, `STATE_UNHANDLED`, `ENUM_VALUE_*`,
  `METHOD_ADDED_TO_INTERFACE`, `POU_DELETED`) have full visibility.
- `CALL_SITE_OUTDATED` now resolves FB-instance calls
  (`fbConveyor(...)` where `fbConveyor : FB_Conveyor`) via the per-POU
  locals catalogue.
- `LOOP_BOUNDS_CHANGED` pairs loops by `(file, scope, loopVar)` instead of
  by line — unrelated edits above the loop no longer hide the change.
- Loop bound resolution now follows `VAR_GLOBAL CONSTANT` identifiers
  through to their numeric value when comparing iteration counts.
- GitHub poster computes which `(file, line)` pairs are inside the PR's
  diff hunks and routes findings on out-of-diff lines into the summary
  issue comment instead of failing the inline review-comment API call.

### Added (static checks)

- Six single-revision static-analysis checks. Each filters to bugs
  introduced in the PR (i.e. not already present in the base revision):
  - `ENUM_VALUE_UNUSED` — enum value declared but never referenced anywhere.
  - `ENUM_MEMBER_UNKNOWN` — `E_State.IDEL`-style typo against a known enum.
  - `ARRAY_INDEX_OUT_OF_BOUNDS` — literal index outside declared bounds.
  - `DIVISION_BY_ZERO` — literal `/ 0` or `VAR_GLOBAL CONSTANT` resolving to 0.
  - `INFINITE_LOOP` — `WHILE TRUE` with no `EXIT` inside.
  - `LOOP_BOUNDS_REVERSED` — `FOR` step direction disagrees with start/end.
- `docs/check-limitations.md` documents what every check (diff-based and
  static) can and cannot catch.
