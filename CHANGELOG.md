# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - next: 0.1.1

### Added

- **Metrics feature, Phase 1: three metric-regression checks** (bringing the total to **55 categories**, 35 single-revision + 20 diff-based): `COMPLEXITY_INCREASED` (cyclomatic complexity rose by more than 5, or crossed the error threshold), `NESTING_INCREASED` (max control-structure nesting depth rose past the warn threshold), and `LOC_SPIKE` (a POU's lines of code grew by more than 50% in one PR). They are diff-based, so they auto-disable in `--lint` mode, and reuse the existing tree-sitter AST, no new parsing.
- **Per-POU metric primitives** under `src/engine/metrics/`: `complexity.ts` (McCabe adapted for ST), `nesting.ts` (max nesting depth), `loc.ts` (LOC / total / comment ratio, comment-aware), and `pou-metrics.ts` (per-file rollup keyed by POU). These are the shared foundation for the upcoming standalone `--metrics` mode (Phase 2).
- **`metrics:` config block** in `.plc-st-review.yml`: `metrics.thresholds.cyclomatic_complexity` and `nesting_depth` drive the threshold-aware checks; `lines_of_code`, `comment_ratio`, and `fan_out` are accepted now and reserved for Phase 2. Defaults match the documented values; the block is optional.

### Changed

- Dev tooling refresh: `vitest` 2 -> 4, `typescript` 5 -> 6, `@types/node` 22 -> 25, `tsx` 4.21 -> 4.22. `@types/node` v25 no longer injects ambient globals automatically, so `tsconfig.json` gained `"types": ["node"]` so `process`, `setTimeout`, and the `node:*` import names still resolve.
- Runtime CLI: `commander` 12 -> 14. Our usage surface is stable across both majors; no API rewiring required.
- GitHub Actions bundle: 11 action versions bumped via Dependabot (`actions/checkout`, `actions/setup-node`, `docker/build-push-action`, and friends). No workflow logic changes.

### Fixed

- Documentation and Marketplace surfaces: README's `## Install` (which was actually the contributor-only bootstrap section) renamed to `### Building from source` under `## Development`; stale test count corrected from 33 to 148; `# once published` removed from the CLI snippet now that 0.1.0 is on npm. The `action.yml` description was refreshed to name the headline check families. The `docs/index.md` Pages landing was rewritten as a marketing surface (hero, "why this matters", 52-category table, 60-second CTA per integration).

## [0.1.0] - 2026-05-15

A substantial release covering 57 commits since 0.0.1. The headline items are 20 new code-quality / style checks (bringing the total to **52 categories**), a new `--lint` CLI mode that makes the tool a first-class CI linter for repos without a PR workflow, a switch from per-comment GitHub POSTs to batched `/reviews` POSTs (one network call, no rate-limit churn), and a docs migration from Jekyll to MkDocs Material with one searchable page per check.

### Added

- **20 code-quality / style check categories** (Phase 6): `EMPTY_STATEMENT`, `UNUSED_RETURN_VALUE`, `ARRAY_SINGLE_ELEMENT`, `VARIABLE_SHADOWING`, `UNQUALIFIED_ENUM_CONSTANT`, `IDENTIFIER_CASE_MISMATCH`, `UNUSED_INPUT_VAR`, `INPUT_VAR_WRITTEN`, `BOOL_COMPARISON`, `REAL_EQUALITY`, `MULTIPLE_EXIT_POINTS`, `ASSIGNMENT_IN_CONDITION`, `COMMENTED_OUT_CODE`, `RECURSIVE_CALL`, `FORBIDDEN_SYMBOL`, `ADDRESS_OF_CONSTANT`, `UNUSED_OUTPUT_VAR`, `OUTPUT_VAR_READ_INTERNALLY`, `NESTED_COMMENTS`, and the configurable `NAMING_CONVENTION`. The project ships **52 check categories** total (35 single-revision + 17 diff-based).
- **`--lint` CLI mode** for static-only linting without a PR or base ref: `plc-st-review --lint "src/**/*.st"` parses the matched files, runs only the single-revision checks (the 17 diff-based categories auto-disable since there is no "before" state), and exits non-zero on findings at or above the fail-on threshold. Glob expander is built in (zero new deps), cross-platform, supports literal paths, directories, `*` (single segment) and `**` (any depth).
- **Config system**: `extends:` mechanism for composing preset packs, `naming_conventions` schema (21 dimensions, with `prefix` / `suffix` / `pattern` combinable per dimension), `forbidden_symbols` blocklist, `naming_ignore` allowlist. Local config overrides everything its presets set; preset cycles are detected.
- **CLI auto-discovers `.plc-st-review.yml`** in the current working directory when `--config` is not passed; emits the resolved path to stderr so CI logs document which config was used.
- **MkDocs Material documentation site** at <https://heytalepazguato.github.io/plc-st-review/>, replacing the Jekyll cayman skin. The `pages.yml` workflow builds with `mkdocs build --strict` and deploys from `main` only; `develop` runs the build job as validation.
- **52 per-check documentation pages** under `docs/checks/{diff-based,static-integrity,fb-instance,code-quality}/`, each with an ST example, severity rationale, and remediation. The top-level `docs/checks-reference.md` is now an index.
- **`docs/preset-packs.md`**: how to compose team / vertical-specific naming and severity bundles via `extends:` without baking any vendor opinion into the engine.
- **`docs/lint-mode.md`**: full reference for the new CI-linter mode, including the auto-disabled-categories table, glob syntax, and CI examples for GitHub Actions and GitLab CI.
- **`examples/presets/example-suffix-types.yml`**: non-blessed template preset showing the suffix-style naming convention.
- **`examples/state-machine/` baseline fixtures**: `FB_Base.st`, `FB_Legacy.st`, `FB_SpeedCalc.st`, `I_Diagnostic.st`, `FB_DiagUnit.st`, `E_DiagMode.st`, `FB_AxisRamp.st`, `FB_Watchdog.st`. The canonical demo PR (#1) edits these to trigger every diff-based check.
- **Dependabot grouping** (`gha`, `npm-prod`, `npm-dev` bundles) to cut chore-PR noise to one PR per bundle per schedule cycle.
- **README shield badges**: version (latest GitHub release tag), CI status, license, Node engine requirement, docs-site link, GHCR container image, total check count.
- **`scripts/strip-em-dashes.py`**: one-shot sweep that removes U+2014 from the codebase. Kept in the tree in case the issue recurs.

### Changed

- **GitHub poster batched**: switched from per-finding `POST /pulls/{N}/comments` to a single `POST /pulls/{N}/reviews` carrying every new inline comment in its `comments[]` array. Eliminates GitHub's secondary rate limiter ("was submitted too quickly" 422 on rapid POSTs), and renders as a single "submitted a review" timeline event instead of N separate review-comment events.
- **Batch chunking** caps each `/reviews` POST at 20 inline comments (configurable via `reviewBatchSize`) with a 1 s gap between batches (`interBatchDelayMs`). GitHub's `/reviews` endpoint 502s on very large payloads, empirically a single batch of 47 took >10 s server-side.
- **Per-comment fallback** retained as a safety net: if a batch fails (e.g. one comment in it is malformed), only that chunk falls back to per-comment POSTs with 250 ms pacing and a one-shot retry on the rate-limit 422. The rest of the batches still go.
- **Em-dashes removed** from all user-visible surfaces: README, docs, source-code comments, and the bot's PR comments. Each em-dash was replaced contextually: `:` for label-value separators (e.g. `**warn `CATEGORY`**: summary`), `(note)` for related-link footers, and `.` or `,` for prose.
- **`tree-sitter-iec61131-3-st` grammar pin** bumped from `^0.0.2` to `^0.1.0`. The new release adds C# bindings via TreeSitter.DotNet but ships no grammar changes, so the engine works unchanged. The bump is necessary because npm's caret treats `0.0.x` as patch-only.
- **README rewritten** to lead with the three-mode framing (static linter, PR / MR reviewer, team-style enforcer) instead of just "code review tool". Adds a "CI linter (no PR required)" Quick-start section with GitHub and GitLab workflow examples.
- **GitHub repo description + topics** updated to surface the linter / static-analysis keywords for search discovery (`ci`, `gitlab-ci` added; existing `linter`, `static-analysis`, `iec61131-3`, `structured-text`, `tree-sitter`, etc. retained).
- **`docs/checks/code-quality/naming_convention.md`** restructured with three tiered examples (prefix-only, prefix+suffix, all three) and framed as the team / company guideline enforcer.

### Fixed

- **`EMPTY_STATEMENT`** no longer fires on phantom semicolons after structured-block terminators (`END_FOR;`, `END_IF;`, `END_WHILE;`, invocation statements). The tree-sitter grammar treats `;` as `empty_statement` and the structured-statement rules don't consume their trailing `;`, so every such terminator produced a spurious finding. The collector now skips empty statements whose previous named sibling is one of the consuming statement types.
- **`ASSIGNMENT_IN_CONDITION`** now detects the ERROR-node shape that tree-sitter emits when `:=` parses as invalid in an expression context (e.g. `IF iCounter := 0 THEN` is not legal ST, so the parser recovers with an `ERROR` node, not an `assignment_statement`).
- **`ADDRESS_OF_CONSTANT`** uses a dedicated `addressOfExprs` collection. `ADR(...)` parses as `address_of_expression`, not `call_expression`, so it never reached `collectCallSites` and the check silently produced zero findings.
- **`RECURSIVE_CALL`** resolves instance → type via the per-POU locals catalogue. A self-call through a self-typed instance (`fbSelf : FB_Self` then `fbSelf()` inside `FB_Self`) is now detected; previously the callee name was the instance, not the type, and the check missed it.
- **`OUTPUT_VAR_READ_INTERNALLY`** uses `VarReference.context` (`'read'` / `'write'` / `'unknown'`) instead of a same-line assignment-target heuristic. `rOut := rOut + 1.0` now fires correctly; the old heuristic masked the read on the right-hand side because the left-hand side wrote on the same line.
- **`pages.yml` workflow** no longer specifies `cache: pip` on `setup-python`: there is no `requirements.txt` to key the cache on, so the step was failing.
- **README pin example** corrected: the GHCR image tag is `:0.0.1`, not `:v0.0.1` (Docker tags don't carry the `v` prefix).

## [0.0.1] - 2026-05-12

### Notes for GitLab users

GitLab support is first-class and ships as part of 0.0.1. The published container image at `ghcr.io/heytalepazguato/plc-st-review:v0` is **public** on GHCR. GitLab runners (including self-hosted) can pull it anonymously, no `docker login` step is needed. Both `gitlab.com` and self-hosted instances are supported via the `GITLAB_URL` / `CI_SERVER_URL` environment variable, which GitLab Runner provides automatically. See [`docs/gitlab-setup.md`](docs/gitlab-setup.md) for the full walkthrough.

### Added

- Engine that parses two `.st` file revisions with the `tree-sitter-iec61131-3-st` grammar and builds per-revision symbol tables for POUs (with their input / output / in-out signatures), global variables, enums, timer instances, call sites, `CASE` statements, and timer PT assignments.
- Eight check categories: `SIGNATURE_CHANGED`, `CALL_SITE_OUTDATED`, `TYPE_MISMATCH`, `ENUM_VALUE_REMOVED`, `ENUM_VALUE_ADDED`, `TIMER_VALUE_CHANGED`, `CONSTANT_VALUE_CHANGED`, `COMMENT_ONLY`.
- CLI with `--base/--head`, `--files`, and `--gitlab --mr` modes; output formats `terminal` (ANSI when TTY), `markdown`, and `json`.
- Local-git diff platform via `simple-git` that loads file pairs from two refs.
- `.plc-st-review.yml` config loader: `disabled_checks`, `severity_overrides`, `ignore_paths`, `safety_critical_prefixes`, `reporting.fail_on_severity`, `reporting.comment_style`.
- GitLab MR integration via `@gitbeaker/rest`:
  - Fetches MR changes, filters to `.st` files, parses before/after revisions at the MR's base/head SHAs.
  - Posts findings as inline discussions with an HTML-comment marker for dedup. On re-run, updates discussions whose body changed, leaves identical ones alone, and resolves discussions whose findings no longer apply.
  - Falls back to a single summary comment above the inline cap (default 100 findings) or when `reporting.comment_style: summary` is set.
  - Honors `GITLAB_TOKEN` / `CI_JOB_TOKEN`, `GITLAB_URL` / `CI_SERVER_URL`, and `GITLAB_PROJECT_ID` / `CI_PROJECT_ID` so the same image works for both gitlab.com and self-hosted instances.
- GitHub PR integration via `@octokit/rest`:
  - Fetches PR changed files, parses before/after revisions at the PR's base/head SHAs.
  - Posts findings as inline review comments (editable individually, unlike formal reviews). Re-runs edit changed bodies, leave identical ones alone, and delete review comments whose findings disappear.
  - Falls back to a single summary issue comment above the inline cap.
  - Composite Docker-based GitHub Action at `action/action.yml` that picks up PR context from the workflow environment.
  - `examples/github-workflow.yml` drop-in workflow.
- Ten additional check categories (18 total): `ARRAY_BOUNDS_CHANGED`, `STATE_UNHANDLED`, `UNREACHABLE_CODE`, `LOOP_BOUNDS_CHANGED`, `POU_DELETED`, `POU_RENAMED`, `METHOD_ADDED_TO_INTERFACE`, `INHERITANCE_CHANGED`, `PRAGMA_CHANGED`, `UNUSED_VAR_INTRODUCED`.
- `docs/writing-custom-checks.md`, `docs/tuning-severities.md`, `docs/gitlab-setup.md`, `docs/github-setup.md`.
- `Dockerfile` (multi-stage: build → slim runtime) for use in GitLab CI and other container-based pipelines.
- `examples/gitlab-ci.yml` drop-in job; `examples/demo/` round-trip fixtures.
- Vitest suite covering each check and platform module (72 tests total, 3 of which drive the real tree-sitter parser end-to-end).
- `patches/tree-sitter+0.25.0.patch` (auto-applied via `patch-package`) bumps the binding's C++ standard from C++17 to C++20 so it compiles against the V8 headers in Node 20+'s `node-gyp` cache.
- `npm run bootstrap` first-install script: installs without scripts, applies the C++20 patch, then rebuilds the two native dependencies in the correct order.

### Fixed

- Symbol extractor now correctly identifies user-defined types and system function blocks (TON / TOF / TP) declared as bare identifiers in the AST, not only as `elementary_type` nodes.
- `childrenOf()` now prefers tree-sitter `namedChildren`, so anonymous tokens (`FOR`, `TO`, `:=`, `;`, ...) no longer pollute positional indexing in collectors like `collectForLoops` and `collectDivisions`.
- `collectTypeDecl` searches inside the `type_definition` child of `type_declaration` for the identifier, enums are now picked up by the real parser.
- GitHub and GitLab snapshot loaders walk the full repo tree at base/head SHAs rather than only the diffed files, so cross-file checks (`CALL_SITE_OUTDATED`, `STATE_UNHANDLED`, `ENUM_VALUE_*`, `METHOD_ADDED_TO_INTERFACE`, `POU_DELETED`) have full visibility.
- `CALL_SITE_OUTDATED` now resolves FB-instance calls (`fbConveyor(...)` where `fbConveyor : FB_Conveyor`) via the per-POU locals catalogue.
- `LOOP_BOUNDS_CHANGED` pairs loops by `(file, scope, loopVar)` instead of by line, unrelated edits above the loop no longer hide the change.
- Loop bound resolution now follows `VAR_GLOBAL CONSTANT` identifiers through to their numeric value when comparing iteration counts.
- GitHub poster computes which `(file, line)` pairs are inside the PR's diff hunks and routes findings on out-of-diff lines into the summary issue comment instead of failing the inline review-comment API call.

### Added (static checks)

- Six single-revision static-analysis checks. Each filters to bugs introduced in the PR (i.e. not already present in the base revision):
  - `ENUM_VALUE_UNUSED`: enum value declared but never referenced anywhere.
  - `ENUM_MEMBER_UNKNOWN`: `E_State.IDEL`-style typo against a known enum.
  - `ARRAY_INDEX_OUT_OF_BOUNDS`: literal index outside declared bounds.
  - `DIVISION_BY_ZERO`: literal `/ 0` or `VAR_GLOBAL CONSTANT` resolving to 0.
  - `INFINITE_LOOP`: `WHILE TRUE` with no `EXIT` inside.
  - `LOOP_BOUNDS_REVERSED`: `FOR` step direction disagrees with start/end.
- `docs/check-limitations.md` documents what every check (diff-based and static) can and cannot catch.

### Added (FB-instance checks)

- Eight checks targeting standard IEC 61131-3 function block patterns:
  - `COUNTER_VALUE_CHANGED`: `CTU`/`CTD`/`CTUD` `PV` changed, severity by ratio (mirrors `TIMER_VALUE_CHANGED`).
  - `COUNTER_PV_ZERO`: preset of 0 makes the counter useless.
  - `TIMER_PT_ZERO`: `PT := T#0s` fires immediately or never.
  - `TIMER_NOT_DRIVEN`: `T1.Q` read but no call site sets `IN`.
  - `EDGE_TRIG_REUSED`: same `R_TRIG`/`F_TRIG` instance fed by multiple `CLK` expressions; scrambles edge detection.
  - `FB_INSTANCE_DOUBLE_CALL`: same FB instance called twice in one POU scope; second call overwrites the first's outputs.
  - `FB_INSTANCE_NEVER_CALLED`: instance whose outputs are read but is never invoked; outputs stuck.
  - `BISTABLE_DOMINANCE_MISMATCH`: `SR`/`RS` choice mismatches the variable name's intent (heuristic, name-pattern based).
- `docs/checks-reference.md`: full per-check reference with ST code example for each trigger and a suggested fix.
- `CallSite.scope` field, call sites now carry their containing POU, enabling scope-aware checks like `FB_INSTANCE_DOUBLE_CALL`.
