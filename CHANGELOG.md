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
- Vitest suite covering each check (30 tests).
