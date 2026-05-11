# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — next: 0.0.1

### Added

- Initial Phase 1 implementation: TypeScript engine that parses two ST file
  revisions with the `tree-sitter-iec61131-3-st` grammar, builds per-revision
  symbol tables (POUs, globals, enums, timers, call sites, CASE statements),
  and runs eight checks.
- Eight check categories: `SIGNATURE_CHANGED`, `CALL_SITE_OUTDATED`,
  `TYPE_MISMATCH`, `ENUM_VALUE_REMOVED`, `ENUM_VALUE_ADDED`,
  `TIMER_VALUE_CHANGED`, `CONSTANT_VALUE_CHANGED`, `COMMENT_ONLY`.
- CLI with `--base/--head` and `--files` modes.
- Three output formats: ANSI terminal, Markdown, JSON.
- Local-git diff platform via `simple-git`.
- `.plc-st-review.yml` config loader with disabled-checks, severity overrides,
  ignore-paths, safety-critical prefixes, and fail-on-severity threshold.
- Vitest suite covering each check (33 tests, 3 of which exercise the real
  tree-sitter parser end-to-end).
- `patches/tree-sitter+0.25.0.patch` (auto-applied via `patch-package`)
  bumps the binding's C++ standard from C++17 to C++20 so it compiles
  against the V8 headers in Node 20+'s `node-gyp` cache.
- `npm run bootstrap` script for first-install: installs deps without
  scripts, applies the C++20 patch, then rebuilds the two native
  dependencies in the correct order.
- Grammar dependency switched from `github:HeytalePazguato/tree-sitter-iec61131-3-st`
  to the npm-published `tree-sitter-iec61131-3-st@^0.0.2`.

### Fixed

- Symbol extractor now correctly identifies user-defined types and system
  function blocks (TON/TOF/TP) declared as bare identifiers in the AST,
  not only as `elementary_type` nodes.

### Phase 2

- GitLab MR integration via `@gitbeaker/rest`:
  - `loadGitlabMrSnapshot` — fetches MR changes, filters to `.st` files,
    parses before/after revisions at the MR's base/head SHAs.
  - `postGitlabReview` — posts findings as inline discussions with an
    HTML-comment marker for dedup. On re-run, updates discussions whose
    body changed, leaves identical ones alone, and resolves discussions
    whose findings no longer apply. Falls back to a single summary
    comment above the inline-cap threshold (default 100 findings) or
    when `reporting.comment_style: summary` is set.
- CLI: new flags `--gitlab`, `--mr <iid>`, `--project <id>`,
  `--gitlab-url <url>`. Honors `GITLAB_TOKEN` / `CI_JOB_TOKEN`,
  `GITLAB_URL` / `CI_SERVER_URL`, `GITLAB_PROJECT_ID` / `CI_PROJECT_ID`.
- `Dockerfile` (two-stage: build → slim runtime) for use in CI.
- `examples/gitlab-ci.yml` reference job configuration.
- 9 new tests cover snapshot filtering, create/update/resolve flows, and
  the summary fallback.
