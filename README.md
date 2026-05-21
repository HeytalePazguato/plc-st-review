# plc-st-review

[![Version](https://img.shields.io/github/v/release/HeytalePazguato/plc-st-review?label=version&color=blue)](https://github.com/HeytalePazguato/plc-st-review/releases/latest) [![CI](https://img.shields.io/github/actions/workflow/status/HeytalePazguato/plc-st-review/ci.yml?branch=develop&label=CI&logo=github)](https://github.com/HeytalePazguato/plc-st-review/actions/workflows/ci.yml) [![License](https://img.shields.io/github/license/HeytalePazguato/plc-st-review)](LICENSE) [![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen?logo=nodedotjs&logoColor=white)](package.json) [![Docs](https://img.shields.io/badge/docs-mkdocs--material-526CFE?logo=materialformkdocs&logoColor=white)](https://heytalepazguato.github.io/plc-st-review/) [![Container](https://img.shields.io/badge/ghcr.io-plc--st--review-2496ED?logo=docker&logoColor=white)](https://github.com/HeytalePazguato/plc-st-review/pkgs/container/plc-st-review) [![Checks](https://img.shields.io/badge/checks-55%20categories-orange)](docs/checks-reference.md)

A **semantic linter, code reviewer, and team-style enforcer** for IEC 61131-3 Structured Text, built for CI on PLC codebases that can't be compiled outside the vendor IDE. Parses `.st` files with the [tree-sitter-iec61131-3-st](https://github.com/HeytalePazguato/tree-sitter-iec61131-3-st) grammar and reports semantic problems, not textual diffs.

`plc-st-review` runs in **three modes**, each backed by the same 55-check engine:

- **Static linter** (`--lint src/**/*.st`), run on every push. 35 single-revision checks for ST bugs: division by zero, out-of-range array indices, infinite loops, TON/CTU/R_TRIG misuse, output reads, unused vars, naming-convention drift, `forbidden_symbols`, and more.
- **PR / MR reviewer** (GitHub Action or GitLab CI job), posts inline review comments on lines that triggered findings. Adds 20 diff-based checks that compare the PR against its base: signature drift, outdated call sites, enum removals, timer-value changes, EXTENDS swaps, pragmas, `SAFETY_*` constant changes, and metric regressions (complexity, nesting, LOC growth).
- **Team-style enforcer**: drop a `.plc-st-review.yml` in the repo root listing your `naming_conventions` (prefix / suffix / pattern per declaration kind) and `forbidden_symbols`. Both modes pick it up automatically.

Catches the bugs reviewers miss on visual scan:

- A `TON.PT` changed from `T#5s` to `T#500ms` (10× faster).
- A function block grew a required input but only some call sites updated.
- A `CASE` on an enum that gained a value but no `ELSE` branch.
- A global variable's type silently changed and the readers are now broken.
- A constant whose name starts with `SAFETY_` had its value changed.

## See it in action

**Live demo:** [**PR #1, every check the tool ships with, posted on a real PR**](https://github.com/HeytalePazguato/plc-st-review/pull/1) 👈 open this for the full bot output. The PR exercises **all 55 check categories** the tool ships with: each shows up as an inline review comment on the changed line that triggered it, and findings on lines outside the PR's diff hunks (e.g. `POU_DELETED`, or a check whose anchor line wasn't itself edited) collect in a single summary comment at the bottom. The PR is intentionally kept open as a fixture; conversation is locked.

A single finding looks like this in the GitHub UI:

<!-- Single-finding screenshot from PR #1. The markdown block below renders as a fallback when the image is missing on a fresh checkout. --> <img src="docs/screenshots/single-finding.png" alt="plc-st-review inline review comment example: FB_INSTANCE_NEVER_CALLED" width="720" />

```
🟧 warn  FB_INSTANCE_NEVER_CALLED
FB instance T3 (TON) is read but never invoked

Outputs of an FB only update when the instance is called.
Reading e.g. `instance.Q` without calling `instance(...)`
returns stale data.
```

A handful more of what's posted on PR #1:

```
FB_ConveyorState.st:26  🟥 error  TIMER_VALUE_CHANGED
                                  Timer T_StartupDelay.PT: T#2s → T#200ms (10.0x faster)

Globals.st:9            🟧 warn   CONSTANT_VALUE_CHANGED
                                  Constant SAFETY_TIMEOUT: T#2s → T#10s
                                  Identifier prefix matches a safety-critical pattern.

FB_Diagnostics.st:49    🟥 error  ARRAY_INDEX_OUT_OF_BOUNDS
                                  arr[15] is out of declared bounds [0..9]

FB_Diagnostics.st:60    🟥 error  INFINITE_LOOP
                                  WHILE TRUE loop with no EXIT statement
```

## Status

- **Phase 1**: engine, eight checks, CLI, three output formats. Done.
- **Phase 2**: GitLab MR integration. Done.
- **Phase 3**: GitHub Action + 10 additional check categories. Done.
- **Static checks**: 6 single-revision checks for common ST bugs.
- **FB-instance checks**: 8 more checks for standard IEC 61131-3 function blocks: timer / counter / edge-trig / bistable misuse.
- **Code-quality + style checks**: 19 more, plus a configurable `NAMING_CONVENTION` check and a config preset-pack mechanism (`extends:`).

Total: **55 check categories** (35 single-revision + 20 diff-based), 167 tests across 59 files, all passing.

## Quick start

### CI linter (no PR required)

Most industrial ST repos don't run on a PR/MR workflow, code lands on `main` after a manual code review and an IDE-side build. You can still get every single-revision check on every push:

```yaml
# .gitlab-ci.yml, lint every .st file on every push, no MR needed
lint-st:
  image: ghcr.io/heytalepazguato/plc-st-review:v0
  script:
    - plc-st-review --lint "src/**/*.st"
```

```yaml
# .github/workflows/lint.yml, same idea on GitHub
name: lint
on: [push]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx plc-st-review --lint "src/**/*.st"
```

`--lint` accepts file paths, directories, or globs (`*`, `**`, mixed). It parses each `.st` file in isolation and runs the **35 single-revision checks**: the 20 diff-based ones are auto-disabled because there's no "before" state. Exit code is non-zero when any finding meets `reporting.fail_on_severity` (default `error`), so the job fails the pipeline on real bugs.

### GitHub pull request

Drop this into `.github/workflows/plc-st-review.yml` (full example at [`examples/github-workflow.yml`](examples/github-workflow.yml)):

```yaml
name: PLC ST Review
on:
  pull_request:
    paths: ['**/*.st', '**/*.ST']
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: HeytalePazguato/plc-st-review@v0
```

The action posts findings as inline review comments. Re-runs update existing comments rather than duplicating.

### GitLab merge request

Drop this into `.gitlab-ci.yml` (full example at [`examples/gitlab-ci.yml`](examples/gitlab-ci.yml)):

```yaml
plc-st-review:
  image: ghcr.io/heytalepazguato/plc-st-review:v0      # or :0.0.1 to pin an exact version
  stage: review
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  variables:
    GITLAB_TOKEN: $CI_JOB_TOKEN
    GITLAB_URL: $CI_SERVER_URL
    GITLAB_PROJECT_ID: $CI_PROJECT_ID
  script:
    - plc-st-review --gitlab --mr "$CI_MERGE_REQUEST_IID"
```

The job fetches the MR's changed `.st` files, runs the review, posts findings as inline discussions, and updates them (rather than creating duplicates) on re-runs.

**Important notes for GitLab users:**

- **Pull credentials**: GitLab runners pull the image from GHCR anonymously. The image is published as **public**, so no `docker login` step is needed. If your runner is offline and you mirror the image internally, pull `ghcr.io/heytalepazguato/plc-st-review:v0` once and push to your internal registry.
- **Self-hosted GitLab**: supported. The example above reads `GITLAB_URL` from `$CI_SERVER_URL`, which is auto-provided by every GitLab runner regardless of whether you're on `gitlab.com` or your own instance.
- **Token scope**: `$CI_JOB_TOKEN` works for most projects with default settings. If your instance restricts job tokens, mint a project access token with `api` scope and set it as a masked, protected CI/CD variable named `GITLAB_TOKEN`, then drop the `GITLAB_TOKEN: $CI_JOB_TOKEN` line.
- **Same engine as the GitHub Action**: every check listed below fires identically on GitLab. There is no GitHub-only path in the engine.

See [`docs/gitlab-setup.md`](docs/gitlab-setup.md) for the full walkthrough and the common-gotchas list.

### CLI

Published on npm:

```sh
npm install -g plc-st-review               # https://www.npmjs.com/package/plc-st-review
plc-st-review --lint "src/**/*.st"         # static linting, no PR / base ref needed
plc-st-review --base main --head HEAD      # diff current branch against main
plc-st-review --files old.st new.st        # compare two specific files
plc-st-review --base main --output json --out-file findings.json
```

Output formats: `terminal` (ANSI when stdout is a TTY), `markdown`, `json`.

The CLI exits non-zero when at least one finding meets or exceeds the `reporting.fail_on_severity` threshold (default `error`).

## Live demo

[PR #1](https://github.com/HeytalePazguato/plc-st-review/pull/1) is kept open as the canonical demo, every check below fires at least once on that PR, with the exact inline comments the bot posts. Open it to see the tool in action on real ST.

## Checks

Each row links to a per-check section in [docs/checks-reference.md](docs/checks-reference.md) with a ST code example and a suggested fix. See also [docs/check-limitations.md](docs/check-limitations.md) for what each check deliberately doesn't catch.

### Diff-based (compare before vs after)

| Category | Default severity | Trigger |
|---|---|---|
| `SIGNATURE_CHANGED` | `warn` (`error` on breaking) | A POU's inputs/outputs/in-outs changed. |
| `CALL_SITE_OUTDATED` | `error` | A caller doesn't pass a required argument the callee now requires, or passes an unknown argument. |
| `TYPE_MISMATCH` | `error` | A `VAR_GLOBAL`'s declared type changed between revisions. |
| `ENUM_VALUE_REMOVED` | `error` | A `CASE` statement references an enum value that was removed. |
| `ENUM_VALUE_ADDED` | `warn` | An enum gained a value but a `CASE` on the enum has no matching branch and no `ELSE`. |
| `TIMER_VALUE_CHANGED` | `info`/`warn`/`error` by ratio | `TON`/`TOF`/`TP` PT changed; severity scales with the change magnitude (≥2× = warn, ≥10× = error). |
| `CONSTANT_VALUE_CHANGED` | `info` (`warn` for safety-prefixed names) | A `VAR_GLOBAL CONSTANT`'s initial value changed. Prefixes like `SAFETY_`, `INTERLOCK_`, `SIL_` elevate severity. |
| `COMMENT_ONLY` | `info` | The AST is structurally identical between revisions; only comments/whitespace changed. |
| `ARRAY_BOUNDS_CHANGED` | `error` (shrink) / `warn` (grow) | An array declaration's `[lower..upper]` bounds changed. |
| `STATE_UNHANDLED` | `info` | A `CASE` on an enum has no `ELSE` and doesn't cover every enum value, regardless of whether the enum changed. |
| `UNREACHABLE_CODE` | `warn` | A new statement was added after `RETURN`/`EXIT`/`CONTINUE` in the same block. |
| `LOOP_BOUNDS_CHANGED` | `info`/`warn` by ratio | A `FOR` loop's bounds changed; severity rises when the iteration count moves ≥10×. |
| `POU_DELETED` | `error` (with callers) / `warn` | A POU was deleted; severity depends on whether call sites in the new revision still reference it. |
| `POU_RENAMED` | `info` | Heuristic: a POU was deleted and another with an identical signature was added; suggests a rename. |
| `METHOD_ADDED_TO_INTERFACE` | `error` | An `INTERFACE` gained a method but a `FUNCTION_BLOCK` that `IMPLEMENTS` it doesn't have one. |
| `INHERITANCE_CHANGED` | `warn` | An `EXTENDS` clause was added, removed, or changed. |
| `PRAGMA_CHANGED` | `info` | The set of pragmas in a file changed (added or removed). |
| `UNUSED_VAR_INTRODUCED` | `info` | A new local variable was declared but isn't referenced in its scope. |
| `COUNTER_VALUE_CHANGED` | `info` / `warn` / `error` by ratio | `CTU`/`CTD`/`CTUD` `PV` changed; severity scales with the change magnitude. |
| `COMPLEXITY_INCREASED` | `warn` (`error` on crossing threshold) | A POU's cyclomatic complexity rose by more than 5, or crossed the configured error threshold. |
| `NESTING_INCREASED` | `warn` (`error` on crossing threshold) | A POU's max control-structure nesting depth rose beyond the configured warn threshold. |
| `LOC_SPIKE` | `info` | A POU's lines of code grew by more than 50% in a single PR. |

### Static (look at the new revision in isolation, filter to bugs new in this PR)

Code-quality + style:

| Category | Default severity | Trigger |
|---|---|---|
| `EMPTY_STATEMENT` | `info` | Lone `;` with nothing in front. |
| `UNUSED_RETURN_VALUE` | `info` | Function called as a bare statement; return discarded. |
| `ARRAY_SINGLE_ELEMENT` | `info` | `ARRAY [5..5] OF T`: single-element array. |
| `VARIABLE_SHADOWING` | `warn` | Local declaration has the same name as a `VAR_GLOBAL`. |
| `UNQUALIFIED_ENUM_CONSTANT` | `info` | Bare `IDLE` matches a member of exactly one enum. |
| `IDENTIFIER_CASE_MISMATCH` | `warn` | Reference uses different case than declaration. |
| `UNUSED_INPUT_VAR` | `info` | `VAR_INPUT` declared but never read. |
| `INPUT_VAR_WRITTEN` | `warn` | `VAR_INPUT` is assigned inside the POU. |
| `BOOL_COMPARISON` | `info` | `IF b = TRUE THEN`: comparison adds no information. |
| `REAL_EQUALITY` | `warn` | `=`/`<>` against a `REAL` literal, unreliable on floats. |
| `MULTIPLE_EXIT_POINTS` | `info` | POU has more than one `RETURN`. |
| `ASSIGNMENT_IN_CONDITION` | `warn` | `IF x := y THEN`: almost always a typo of `=`. |
| `COMMENTED_OUT_CODE` | `info` | Comment whose content looks like ST source. |
| `RECURSIVE_CALL` | `warn` | POU invokes itself; risks stack overflow on bounded runtimes. |
| `FORBIDDEN_SYMBOL` | `error` (config-driven) | Identifier matches the repo's `forbidden_symbols` blocklist. |
| `ADDRESS_OF_CONSTANT` | `warn` | `ADR(c)` where `c` is a `VAR_GLOBAL CONSTANT`. |
| `UNUSED_OUTPUT_VAR` | `info` | `VAR_OUTPUT` declared but never written. |
| `OUTPUT_VAR_READ_INTERNALLY` | `info` | `VAR_OUTPUT` read inside the POU; usually a sign you wanted a local. |
| `NESTED_COMMENTS` | `info` | Block comment contains another block comment. |
| `NAMING_CONVENTION` | `warn` (config-driven) | Declaration name doesn't match the configured prefix / suffix / regex. See [docs/preset-packs.md](docs/preset-packs.md). |

Single-revision integrity:

| Category | Default severity | Trigger |
|---|---|---|
| `ENUM_VALUE_UNUSED` | `info` | An enum value is declared but no longer referenced anywhere in the repo. |
| `ENUM_MEMBER_UNKNOWN` | `error` | A qualified ref like `E_State.IDEL` doesn't match any declared member of `E_State`: likely a typo. |
| `ARRAY_INDEX_OUT_OF_BOUNDS` | `error` | A literal index sits outside the array's declared bounds (`arr[15]` when `arr` is `ARRAY [0..9]`). |
| `DIVISION_BY_ZERO` | `error` | The divisor is a literal `0`, or a `VAR_GLOBAL CONSTANT` resolving to 0. |
| `INFINITE_LOOP` | `error` | `WHILE TRUE DO ... END_WHILE;` with no `EXIT` inside the body. |
| `LOOP_BOUNDS_REVERSED` | `error` | `FOR` loop bounds and step point opposite directions, per spec body never runs, on overflow-wrapping runtimes it runs ~unlimited times. |
| `COUNTER_PV_ZERO` | `error` | `CTU`/`CTD`/`CTUD` initialized with `PV := 0`: Q always TRUE or counter useless. |
| `TIMER_PT_ZERO` | `error` | `TON`/`TOF`/`TP` set with `PT := T#0s`: fires immediately or never. |
| `TIMER_NOT_DRIVEN` | `warn` | A timer's `Q`/`ET` is read but no call site sets `IN`. |
| `EDGE_TRIG_REUSED` | `error` | Same `R_TRIG`/`F_TRIG` instance fed by multiple different `CLK` expressions. |
| `FB_INSTANCE_DOUBLE_CALL` | `warn` | Same FB instance invoked more than once in one scope's scan. |
| `FB_INSTANCE_NEVER_CALLED` | `warn` | FB instance declared, its outputs read, but no call site invokes it. |
| `BISTABLE_DOMINANCE_MISMATCH` | `info` | `SR`/`RS` choice mismatches the variable name's intent (heuristic). |

## Configuration

Create `.plc-st-review.yml` at the repo root:

```yaml
disabled_checks:
  - COMMENT_ONLY

severity_overrides:
  TIMER_VALUE_CHANGED: error   # all timer changes block merge

ignore_paths:
  - "deprecated/**"
  - "third_party/**"

safety_critical_prefixes:
  - SAFETY_
  - INTERLOCK_
  - SIL_

reporting:
  fail_on_severity: error      # exit-nonzero threshold
  comment_style: inline        # inline | summary | both (GitLab/GitHub)

metrics:                       # bands for the metric-regression checks
  thresholds:
    cyclomatic_complexity:
      warn: 15
      error: 25
    nesting_depth:
      warn: 5
      error: 8
```

The `metrics` block is optional; the values shown are the defaults. `COMPLEXITY_INCREASED` and `NESTING_INCREASED` read these bands; `LOC_SPIKE` fires on any single-PR growth over 50%. See [`docs/checks-reference.md`](docs/checks-reference.md#metric-thresholds) for the full block (the `lines_of_code`, `comment_ratio`, and `fan_out` keys are accepted now and consumed by the upcoming standalone `--metrics` mode).

## How it works

Every change is reduced to an AST diff. The engine:

1. Parses the `before` and `after` versions of every changed `.st` file with the tree-sitter grammar. 2. Builds a **symbol table** per revision: POUs (with parameter signatures), global variables, enums, timer instances, call sites, `CASE` statements. 3. Hands both tables to each registered check. Each check is a self-contained module under `src/engine/checks/`. 4. Renders the resulting findings to terminal / Markdown / JSON.

No LLM is involved. Findings are deterministic.

## Development

> Contributors only. End users don't need this section: the GitHub
> Action, GitLab CI image, and npm CLI are all ready to use without
> building from source.

```sh
npm run bootstrap          # first-time only; see "Building from source" below
npm run build              # tsc to dist/
npm test                   # vitest, ~9s, 167 tests across 59 files
npm run lint               # tsc --noEmit
```

### Building from source

```sh
npm run bootstrap
```

`bootstrap` runs `npm install --ignore-scripts`, applies the local `tree-sitter` C++20 patch, and rebuilds the two native deps in the right order. This dance is needed because `tree-sitter` 0.25.0's `binding.gyp` specifies `/std:c++17`, but Node 20+'s V8 headers require C++20, and a plain `npm install` triggers tree-sitter's source build before `postinstall: patch-package` ever gets a chance to fix it.

A plain `npm install` works once `node_modules/` already exists and the patch has been applied (the `postinstall` hook keeps the patch fresh on subsequent installs).

### Native build prerequisites

- **Windows:** Visual Studio 2022 with the **Desktop development with C++** workload, plus the individual components **C++ Clang Compiler for Windows** and **MSBuild support for LLVM (clang-cl) toolset**. Both are required: `node-addon-api` 8.5+ uses the `ClangCL` MSBuild platform toolset.
- **Linux/macOS:** standard `gcc`/`clang` + `make` chain.
- **All platforms:** npm ≥ 10 (bundles `node-gyp` ≥ 10 with VS2022 detection on Windows).

The `patches/tree-sitter+0.25.0.patch` file goes away once upstream tree-sitter publishes a release with C++20 set as the default.

## Roadmap

Likely additions, in rough priority order:

- **Standalone CLI binaries**: `plc-st-review-linux-x64`, `-darwin-arm64`, etc. as GitHub Release assets, for shops that don't have Node installed. Skipped for 0.0.1 because the native deps (`tree-sitter`, `tree-sitter-iec61131-3-st`) ship as `.node` files that don't bundle cleanly through `pkg` or `bun --compile` without per-platform asset handling. Revisit if real users without Node ask.
- **Optional LLM-powered explanations**: a `--explain` flag that paraphrases deterministic findings in plain English for less-experienced reviewers. Strictly additive, every explanation is grounded in a deterministic finding; the LLM never surfaces new issues.
- **Vendor-specific checks**: PLCopen `MC_*` motion patterns, TwinCAT / CODESYS / ABB-specific library FBs. Currently the engine sticks to standard IEC 61131-3 to stay portable across vendors.

## License

MIT, see [LICENSE](LICENSE).
