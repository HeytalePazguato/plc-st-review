# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-06-01

### Fixed

- **Parameters were double-counted as locals.** The symbol-table collector walked every `var_section` block (including `VAR_INPUT` / `VAR_OUTPUT` / `VAR_IN_OUT`) and pushed every variable declaration into `pouLocals`, so each parameter appeared as both a `var_input` (via `Pou.inputs`) AND a `var_local` (via `pouLocals`) `NamedDecl`. Two cascades surfaced when the v1.0 demo PR ran: `NAME_REUSED_DIFFERENT_KIND` fired on every parameter (`Name 'xCount' is reused across kinds (var_input, var_local)`), and `UNINITIALIZED_VAR_USED` fired on every parameter read (`'xCount' is read before any assignment`) — together adding ~100 false-positive findings on clean POUs and pushing the inline-comment count past the bot's 100-comment inline cap so PR #1 fell back to summary-only mode. The collector's local push is now gated to local-storage sections (`VAR_BLOCK`, `VAR_TEMP`, `VAR_EXTERNAL`); the timer / counter / edge-trigger / bistable / pointer / array indexes still walk every section so an FB-instance declared as a parameter (uncommon but valid) doesn't go unindexed. Real-parser regression test added.

## [1.0.0] - 2026-06-01

`plc-st-review` reaches 1.0. This release adds 24 new check categories (bringing the engine to **80 categories** total), three new standards-mapping pages (PLCopen Coding Guidelines, MISRA-C, IEC 61508 positioning, IEC 62443 industrial cybersecurity), a configurable case-sensitivity model for dialect compatibility (CODESYS / TwinCAT / generic IEC default to case-insensitive; B&R Automation Studio opt-in case-sensitive), a `limits` config block for PLCopen-recommended size / count caps, base-ref config loading on PR / MR modes, a configurable per-file size cap, and ~12 correctness bugfixes covering case-handling, number-literal parsing, scope resolution, and unreachable / loop / FB-instance edge cases.

The 1.0 contract: `.plc-st-review.yml` schema keys, CLI flags, JSON output format, and per-check default behavior are stable. Future breaking changes to any of those require a 2.0 bump. Additive changes (new check categories, new config keys with safe defaults, severity adjustments via `severity_overrides`) stay in 1.x.

### Added

- **Five new IEC 62443 industrial-cybersecurity checks**, the first OSS PLC linter to ship targeted checks against the 62443 secure-coding clauses (to our knowledge). New categories: `HARDCODED_CREDENTIALS` (62443-4-2 CR 1.5, severity `error`) — secret-named variable with a literal STRING initialiser; `HARDCODED_NETWORK_ENDPOINT` (62443-4-1 SI-1, severity `warn`) — STRING literal that's an IPv4 dotted-quad or an `http(s)/tcp/udp/opc(.tcp)/mqtt(s)/modbus/ssh/ftp` URL, with `127.0.0.1` / `0.0.0.0` / `localhost` allowlisted; `UNVALIDATED_INPUT_USE` (62443-4-2 CR 3.5, severity `info`) — `VAR_INPUT` used as array subscript or divisor with no in-POU relational guard; `DEBUG_PRAGMA_IN_PRODUCTION` (62443-4-1 SI-2, severity `warn`) — vendor pragmas matching `debug` / `test` / `monitoring` / `force_init` / `trace` / `instance-path` in non-test source paths (`tests/`, `examples/`, `fixtures/`, `_test.st` are skipped); `PERSISTENT_PLAINTEXT_SECRET` (62443-4-2 CR 4.1, severity `error`) — `VAR_GLOBAL PERSISTENT` / `RETAIN` of secret-named variables (the data lives in NV memory and is readable through engineering-tool access). All five are single-revision checks that run by default; they can be disabled via `disabled_checks` like any other category. The check brings the total from 75 to **80 categories** (54 → 59 single-revision; 73 → 78 always-on; 21 diff-based unchanged); README, docs/index.md, lint-mode doc, action.yml, and package.json description updated to match.
- **Standards-mapping page: IEC 62443** (`docs/standards/iec-62443.md`). Per-clause mapping for the 62443-4-1 secure-development practices (SD / SI / SVV / DM / SUM) and 62443-4-2 Foundational Requirements (FR1 auth, FR3 system integrity, FR4 confidentiality at rest) that the engine helps satisfy, plus an honest "FR 2 / FR 5 / FR 6 / FR 7 — out of scope" note explaining why most of the standard is runtime-only and not statically inferable. Suggested `fail_on_severity` policy by Security Level (SL 1-4). Wired into the mkdocs nav alongside the MISRA-C and IEC 61508 mapping pages.
- **Standards-mapping pages: MISRA-C and IEC 61508.** New top-level "Standards mapping" nav group with two pages. `docs/standards/misra-c.md` is an intent-level table mapping each `plc-st-review` check to the closest MISRA-C:2012 rule (where one exists) — ~25 numbered-rule matches, ~5 directive matches, plus an honest list of PLC-domain checks with no C analogue. `docs/standards/iec-61508.md` positions the engine against IEC 61508-3 Annex A/B *techniques* (defensive programming, limited pointers, limited recursion, no unconditional jumps, static analysis, boundary-value analysis, …) at each SIL level, with suggested `fail_on_severity` defaults per SIL band. The 61508 page carries a prominent "**not TÜV-qualified**" caveat that also explains what TÜV is (Technischer Überwachungsverein — German technical-inspection bodies that audit safety tools), what an IEC 61508-3 Tool Class T2 qualification involves, and why integrator-side qualification is still possible without vendor-side certification.
- **`docs/deterministic.md` — a dedicated "Deterministic by design (no LLM)" page**, wired into the mkdocs nav as a top-level entry beside the home page. Spells out the four properties the engine's no-LLM, AST-only architecture buys you over LLM-based code reviewers: reproducible (same input → same output, byte for byte), auditable (every finding maps to one check module you can read + a test fixture), air-gappable (one Docker image, zero outbound traffic), and your-source-never-leaves-the-network. Includes a side-by-side positioning table against LLM-based reviewers, and explicitly carves out where a paraphrase-only `--explain` mode would be additive without surfacing new findings. README's "How it works" gets a parallel short section linking to the page.
- **Six more PLCopen rules implemented**, closing the gap surfaced by the comparison against `iec-checker`. New categories: `UNINITIALIZED_VAR_USED` (CP3), `EXTERNAL_VAR_IN_FUNCTION` (CP6), `IMPLICIT_TYPE_CONVERSION` (CP25), `MULTI_WRITER_GLOBAL` (CP26, project-scoped), `TIME_EQUALITY` (CP28), and `IDENTIFIER_CHARSET` (N8). Plus a new top-level `identifier_charset` config key (regex any identifier must match; off when unset; the PLCopen preset sets the IEC standard's identifier grammar). PLCopen coverage in `presets/plcopen.yml` rises from 24 mapped + 1 partial to 30 mapped + 1 partial, with only 5 rules genuinely out of scope (task-model / cycle / intent rules). `VAR_EXTERNAL` is now its own `DeclKind`.
- **PLCopen Coding Guidelines preset (`presets/plcopen.yml`)** plus **13 new general-purpose checks**. The checks themselves aren't PLCopen-specific — they're standalone code-quality / static-integrity / size-limit categories that the engine ships and that the PLCopen preset configures to PLCopen-recommended severities. Opinionated ones (`FORBIDDEN_STATEMENT`, `DIRECT_ADDRESS_USED`, `IF_WITHOUT_ELSE`) default to `info` severity so they're visible but not blocking; the preset bumps them to `warn`. The preset is layered via `extends: ./presets/plcopen.yml`. New categories: `DIRECT_ADDRESS_USED` (N1 / CP1), `IF_WITHOUT_ELSE` (L17), `FORBIDDEN_STATEMENT` (L10 — EXIT / CONTINUE / GOTO), `IDENTIFIER_TOO_LONG` (N6), `NAME_REUSED_DIFFERENT_KIND` (N9), `POU_NOT_COMMENTED` (C2), `TOO_MANY_PARAMETERS` (CP23), `TOO_MANY_GLOBALS_USED` (CP18), `FOR_LOOP_VAR_MODIFIED` (L12), `FOR_LOOP_VAR_USED_AFTER` (L13), `POINTER_ARITHMETIC` (E2), `POINTER_COMPARED` (E3), `INDIRECT_RECURSIVE_CALL` (CP13 indirect). Plus a `limits` config block (`max_identifier_length`, `max_globals_used_per_pou`, `max_parameters`) for the size-/count-checking rules — each defaults to "off" and is enabled by the preset to PLCopen-recommended values (32 / 10 / 8). Full PLCopen rule → check mapping at `docs/presets/plcopen.md`: 24 mapped + 1 partial + 8 out of scope. No tree-sitter grammar changes required.

- **Configurable identifier case sensitivity** via a top-level `case_sensitive` key in `.plc-st-review.yml` (default `false`). Identifier case-handling is dialect-dependent: generic IEC 61131-3, Beckhoff/TwinCAT and CODESYS are case-insensitive, while B&R Automation Studio is case-sensitive. The symbol table now routes the `globals`, `enums`, and named-call-argument maps through a single case-aware map so insertion and lookup always agree. This fixes a class of silent false negatives where a constant/global/standard-parameter referenced in a different case than its declaration (e.g. `MAXCOUNT` vs `MaxCount`, `pt :=` vs `PT :=`) failed to resolve. When `case_sensitive: true`, `IDENTIFIER_CASE_MISMATCH` is automatically disabled (a differing case is a different symbol, not a style slip).

### Security

- **Per-file source-size cap (configurable; 1 MB default).** `parseSource` now skips any file whose source exceeds the cap, emitting a one-line stderr warning and returning an empty-stub AST so downstream checks treat it as a no-op. Defends against pathological or hostile single files that could otherwise blow up memory in the native parser; ordinary ST files are well under the cap. Configurable via `parsing.max_file_size_bytes` in `.plc-st-review.yml`, overridable per run with `--max-file-size <bytes>` on the CLI; set `0` to disable the cap entirely.
- **GitHub tree-truncation fallback.** When `git.getTree({ recursive: true })` reports `truncated: true` on a very large repo (>~100k entries or 7 MB), `listStFiles` now falls back to a per-subtree walk via `walkTreeForStFiles` so `.st` files past the cap are no longer silently dropped. Costs one extra API call per directory on the truncated path; no impact on normal-sized repos. A still-truncated subtree emits its own warning rather than aborting.
- **PR / MR review now loads its config from the base commit, not the checked-out PR head.** In CI the working directory holds the PR-head code, which on a fork PR is attacker-controlled — so a malicious `.plc-st-review.yml` shipped in the PR could change which rules ran, supply a catastrophic-backtracking regex (ReDoS), or use `extends:` to read arbitrary local files during config discovery. `--github` and `--gitlab` modes now fetch `.plc-st-review.yml` (then `plc-st-review.yml`) from `context.baseSha` via the platform API and use that. The cli also skips cwd auto-discovery in those modes. `--config <path>` still wins when supplied explicitly. Local modes (`--lint`, `--files`, `--metrics`, `--base`) keep cwd discovery unchanged — the author runs them and owns their own config there.
- Bumped transitive dependencies to clear `npm audit` advisories: `qs` 6.15.1 -> 6.15.2 (GHSA-q8mj-m7cp-5q26, `qs.stringify` DoS; reaches the shipped CLI via `@gitbeaker/rest`) and `tmp` 0.2.5 -> 0.2.7 (GHSA-ph9p-34f9-6g65, path traversal; build-time only, via `patch-package`). `npm audit` now reports 0 vulnerabilities. Lockfile-only change, no API or behaviour impact.
- Hardened the release workflows against version-string command injection: `release.yml` now rejects a `VERSION` file that isn't a bare `X.Y.Z`, and `prerelease.yml` applies the same check to the version derived from the `release/*` branch name. Both values are interpolated into later `git tag` / image-tag steps, so a crafted value could otherwise execute in those privileged jobs. CI-only; no impact on the published package.

### Fixed

- **`UNREACHABLE_CODE` now flags every dead statement after a terminator (L12)**, not just the first. `RETURN; a; b; c;` previously surfaced only `a`; the collector's per-statement terminator reset was preventing subsequent statements in the same block from being marked. The terminator now sticks for the remainder of the enclosing block, and descending into a fresh block resets it correctly.
- **Cyclomatic complexity now counts `&` and `XOR` as decision points (L13)**, alongside the existing `AND` / `OR`. IEC 61131-3 treats `&` as a synonym for `AND` on BOOL operands and `XOR` as a logical operator; both create a decision branch and each should bump the count. Verified against the real grammar: the token types are exactly `AND` / `OR` / `XOR` / `&`. POU complexity is now reported accurately for booleans written with either spelling.
- **POU metrics now key by qualified name, not bare name (L15).** Two same-named POUs in different namespaces within one file (`NAMESPACE NSa FUNCTION_BLOCK FB_X` and `NAMESPACE NSb FUNCTION_BLOCK FB_X`) previously collided in `computeFileMetrics` — one set of metrics silently overwrote the other, and `--metrics --json` under-reported. `PouMetrics.name` is now the qualified name (matching the keying `symbols.pous` already uses), and the metric aggregator looks up by `pou.qualifiedName`. Files without namespaces are unaffected (qualified name == bare name).
- **`ARRAY_INDEX_OUT_OF_BOUNDS` multi-dimensional limit explicitly documented (L14).** For `arr[i, j]` against `ARRAY [0..9, 0..5]` only the **first** subscript was being compared against the **first** declared dimension; the second-and-later subscripts were silently skipped. This is now called out as a deliberate scope limit on the per-check page and the [Check limitations](check-limitations.md) page rather than left as an undocumented surprise. Same limit applies to `ARRAY_BOUNDS_CHANGED` and `ARRAY_SINGLE_ELEMENT`.
- **Symbol-table case-sensitivity extended to `pous` and `pouLocals`.** When the previous `CaseMap` rollout landed, the POU table and the per-POU local catalogue were still raw `Map`s. That left a residual silent-failure surface in case-insensitive dialects (TwinCAT / CODESYS / generic IEC): an FB-typed local declared as `: fb_helper` against a POU declared `FB_Helper` failed to resolve through the type-text lookup in `inferLocalKind` and was classified as a plain `var_local` — which silently defanged `FB_INSTANCE_DOUBLE_CALL` and `FB_INSTANCE_NEVER_CALLED` on that instance. Both maps are now built on `CaseMap`, so casing differences between declaration and use no longer drop FB-instance detections in case-insensitive mode.
- **Cross-file globals with the same name no longer silently clobber each other (H1).** Previously, when two files declared `gShared`, the second file's decl overwrote the first in `globals` and `buildDeclarations` could only see one — blinding `NAME_REUSED_DIFFERENT_KIND` to cross-file collisions and under-counting `--metrics --json` `totalGlobals`. A new `globalDecls: GlobalVar[]` field retains every site in source order; `buildDeclarations` and the project-metrics aggregator iterate it, while `globals.get` / `globals.has` keep their familiar last-write-wins by-name semantics for predicates that don't care which file owns the decl.
- **`VARIABLE_SHADOWING` now also covers instance shadowing.** Previously the check only treated value-kind declarations (`VAR`, `VAR_INPUT`, `VAR_OUTPUT`, `VAR_IN_OUT`, `VAR_TEMP`) as candidates, so a local FB / timer / counter / edge-trigger / bistable instance with the same name as a global of the same name went undetected. All five instance kinds are now included.
- **`ENUM_VALUE_REMOVED` matches CASE arms exactly and honours the case-sensitivity setting.** The check used a substring match (`cv.includes(v.name)`), so removing `STOP` while `E_State.EMERGENCY_STOP` survived wrongly produced an error-level "still referenced" finding pointing at `EMERGENCY_STOP`, and removing `RUN` could be masked by surviving `RUNNING` arms. It also compared value names case-sensitively, so a case-only value rename (`idle` -> `IDLE`) was wrongly reported as a removal. CASE arms are now matched exactly against either the bare value name or the `EnumName.Value` qualified form (with comma-separated arms split), and comparisons normalize per `case_sensitive` (default insensitive).
- **Scope-aware reference resolution.** Three related defects in how the engine attributed source lines to POUs and resolved identifiers across them are fixed together. (1) `pouContainingLine` previously picked the closest POU by start line without checking the POU's end line, so code above the first POU, between POUs, or after the last POU was mis-attributed to a neighbouring POU; `Pou` now carries `endLine` and containment is strict. (2) `IDENTIFIER_CASE_MISMATCH` resolved declarations through a single file-wide map, so a `count` in `FB_A` was wrongly matched against a `Count` declared in `FB_B`; resolution now walks the lexical scope chain (POU → parent FB → `__global`) per reference. (3) `UNUSED_VAR_INTRODUCED` counted uses file-wide, so a truly unused local was hidden whenever an unrelated POU in the same file happened to use the same name; references are now counted only inside the declaration's scope chain.
- **`TIMER_NOT_DRIVEN` no longer false-positives on a positional timer call.** The check required a named `IN := ...` argument to consider the timer driven, so a valid positional call `T1(bStart, T#5s)` was misread as "no call sets IN" when `T1.Q` was read. Positional invocation now counts as driving IN (the IEC standard timers `TON`/`TOF`/`TP` declare IN as the first positional input). `EDGE_TRIG_REUSED` was already handling positional `CLK`; its now-redundant case-fallback lookup chain was simplified.
- **Radix, digit-separator, and typed numeric literals are now decoded correctly in value checks.** Checks that compare against literal values (`ARRAY_INDEX_OUT_OF_BOUNDS`, `ARRAY_BOUNDS_CHANGED`, `ARRAY_SINGLE_ELEMENT`, `DIVISION_BY_ZERO`, `COUNTER_PV_ZERO`, `COUNTER_VALUE_CHANGED`, `LOOP_BOUNDS_REVERSED`, `LOOP_BOUNDS_CHANGED`) used `parseFloat`, which reads `16#FF` as `16`, `2#1010` as `2`, and `1_000` as `1` — missing real issues such as an out-of-bounds `arr[2#10000]`. A shared IEC literal parser now decodes based literals (base 2–36), digit-group separators, and typed prefixes (`INT#`, `UINT#16#FF`), so these checks see the true value.
- **`LOOP_BOUNDS_REVERSED` no longer false-positives on a valid descending loop with a non-literal step.** A literal step (`BY -2`) was already handled, but `BY (-2)` (parenthesized) and `BY -STEP` (negated constant) were dropped, so the check fell back to assuming `+1` and flagged a correct `FOR i := 10 TO 1 BY (-2)` as reversed. The step expression is now captured in all forms, parenthesized/unary steps are resolved, and an unresolvable step is skipped rather than assumed positive.
- **Assignment targets were misclassified as reads.** Reference-context detection compared AST nodes by object identity, but the tree-sitter binding returns a fresh wrapper on every access, so the comparison never held and every assignment left-hand side was recorded as a read. This made `OUTPUT_VAR_READ_INTERNALLY` fire on write-only outputs (an output that is only ever assigned, never read back). Node comparison is now positional, so a write-only output no longer triggers the check.

## [0.2.1] - 2026-05-25

### Changed

- **`--metrics` Graphviz `dot` export is now self-describing**: every node is labelled with its complexity / nesting / LOC, dead POUs are filled dashed-grey and marked `(dead - no callers)`, and a legend maps each fill to its meaning. A rendered call graph now shows what is complex and what is abandoned instead of a field of identical green boxes.
- **Dead-POU detection is inheritance-aware.** A POU reached only through `EXTENDS` / `IMPLEMENTS` is now treated as used, so base classes and implemented function blocks are no longer false-flagged as dead. Applies to both the `--metrics` dead-code list and the `DEAD_POU_INTRODUCED` check.
- Release workflow now publishes to npm via **OIDC Trusted Publishing** instead of a long-lived `NPM_TOKEN` (npm bumped to latest in CI for OIDC support). Requires a one-time trusted-publisher configuration on npmjs.com for this repo + `release.yml`; the `NPM_TOKEN` secret is no longer used and can be removed.
- Dev-dependency patch bumps via Dependabot (`npm-dev` group): `@types/node` 25.9.0 -> 25.9.1, `tsx` 4.22.2 -> 4.22.3, `vitest` 4.1.6 -> 4.1.7. No API or behaviour changes.

## [0.2.0] - 2026-05-21

### Added

- **`--metrics` mode**: a standalone whole-codebase report (it does not run the review checks). Per POU it computes cyclomatic complexity, nesting depth, lines of code, variable / input / output / method counts, statement / branch / return counts, and call-graph fan-in / fan-out; project-wide it rolls up dead POUs, orphan types, dependency depth, call cycles, and doc coverage. Output as `terminal`, `json`, Graphviz `dot` (call graph), or a shields.io `badge`, with `--sort`, `--top`, and `--threshold metric=value` (CI gate). Reuses the existing tree-sitter AST and symbol table, no new parser. See `docs/metrics-mode.md`.
- **Four new diff-based checks** (total now **56 categories**, 35 single-revision + 21 diff-based): `COMPLEXITY_INCREASED` (cyclomatic complexity rose by more than 5, or crossed the error threshold), `NESTING_INCREASED` (max nesting depth rose past the warn threshold), `LOC_SPIKE` (a POU's lines of code grew by more than 50% in one PR), and `DEAD_POU_INTRODUCED` (a newly added FUNCTION / FUNCTION_BLOCK that nothing in the project calls). All are diff-based and auto-disable in `--lint` mode.
- **`--project-scope` (opt-in whole-repo parse)**: review modes can additionally parse the whole repository from the head checkout so project-scoped checks like `DEAD_POU_INTRODUCED` can see callers outside the diff. Off by default and never run on a normal PR; enable it on demand, a PR label is the recommended trigger. Exposed as the `project-scope` GitHub Action input; recipe in `examples/github-workflow-project-scope.yml`. See `docs/project-scope.md`.
- **`metrics:` config block** in `.plc-st-review.yml`: `cyclomatic_complexity`, `nesting_depth`, `lines_of_code`, `comment_ratio`, and `fan_out` bands, consumed by the metric-regression checks and by `--metrics` status colouring and badge. Defaults match the documented values; the block is optional.

### Changed

- Dev tooling refresh: `vitest` 2 -> 4, `typescript` 5 -> 6, `@types/node` 22 -> 25, `tsx` 4.21 -> 4.22. `@types/node` v25 no longer injects ambient globals automatically, so `tsconfig.json` gained `"types": ["node"]` so `process`, `setTimeout`, and the `node:*` import names still resolve.
- Runtime CLI: `commander` 12 -> 14. Our usage surface is stable across both majors; no API rewiring required.
- GitHub Actions bundle: 11 action versions bumped via Dependabot (`actions/checkout`, `actions/setup-node`, `docker/build-push-action`, and friends). No workflow logic changes.

### Fixed

- `--files <before> <after>`: the space-separated form documented in the README errored with `too many arguments` (the option consumed only one path). It is now variadic and accepts two paths as documented; passing any count other than two fails with a clear message.

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
