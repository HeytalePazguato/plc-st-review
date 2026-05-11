# plc-st-review

Semantic code review for IEC 61131-3 Structured Text pull/merge requests. Parses
old and new versions of `.st` files with the
[tree-sitter-iec61131-3-st](https://github.com/HeytalePazguato/tree-sitter-iec61131-3-st)
grammar and reports semantic changes — not textual diffs.

Catches the bugs reviewers miss on visual scan:

- A `TON.PT` changed from `T#5s` to `T#500ms` (10× faster).
- A function block grew a required input but only some call sites updated.
- A `CASE` on an enum that gained a value but no `ELSE` branch.
- A global variable's type silently changed and the readers are now broken.
- A constant whose name starts with `SAFETY_` had its value changed.

## Status

- **Phase 1** — engine, eight checks, CLI, three output formats. Done.
- **Phase 2** — GitLab MR integration. Done.
- **Phase 3** — GitHub Action + 10 additional check categories
  (18 total). Done.

Total tests: 72 across 24 files, all passing.

## Quick start

### GitHub pull request

Drop this into `.github/workflows/plc-st-review.yml` (full example at
[`examples/github-workflow.yml`](examples/github-workflow.yml)):

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

The action posts findings as inline review comments. Re-runs update
existing comments rather than duplicating.

### GitLab merge request

Drop this into `.gitlab-ci.yml` (full example at
[`examples/gitlab-ci.yml`](examples/gitlab-ci.yml)):

```yaml
plc-st-review:
  image: ghcr.io/heytalepazguato/plc-st-review:latest
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

The job fetches the MR's changed `.st` files, runs the review, posts
findings as inline discussions, and updates them (rather than creating
duplicates) on re-runs. Self-hosted GitLab is supported via `GITLAB_URL`.

### CLI

```sh
npm install -g plc-st-review            # once published
plc-st-review --base main --head HEAD   # diff current branch against main
plc-st-review --files old.st new.st     # compare two specific files
plc-st-review --base main --output json --out-file findings.json
```

Output formats: `terminal` (ANSI when stdout is a TTY), `markdown`, `json`.

The CLI exits non-zero when at least one finding meets or exceeds the
`reporting.fail_on_severity` threshold (default `error`).

## Checks

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
```

## How it works

Every change is reduced to an AST diff. The engine:

1. Parses the `before` and `after` versions of every changed `.st` file with
   the tree-sitter grammar.
2. Builds a **symbol table** per revision: POUs (with parameter signatures),
   global variables, enums, timer instances, call sites, `CASE` statements.
3. Hands both tables to each registered check. Each check is a self-contained
   module under `src/engine/checks/`.
4. Renders the resulting findings to terminal / Markdown / JSON.

No LLM is involved. Findings are deterministic.

## Install

```sh
npm run bootstrap
```

`bootstrap` runs `npm install --ignore-scripts`, applies the local
`tree-sitter` C++20 patch, and rebuilds the two native deps in the right
order. This dance is needed because `tree-sitter` 0.25.0's `binding.gyp`
specifies `/std:c++17`, but Node 20+'s V8 headers require C++20 — and a
plain `npm install` triggers tree-sitter's source build before
`postinstall: patch-package` ever gets a chance to fix it.

A plain `npm install` works once `node_modules/` already exists and the
patch has been applied (the `postinstall` hook keeps the patch fresh on
subsequent installs).

### Native build prerequisites

- **Windows:** Visual Studio 2022 with the **Desktop development with C++**
  workload, plus the individual components **C++ Clang Compiler for Windows**
  and **MSBuild support for LLVM (clang-cl) toolset**. Both are required:
  `node-addon-api` 8.5+ uses the `ClangCL` MSBuild platform toolset.
- **Linux/macOS:** standard `gcc`/`clang` + `make` chain.
- **All platforms:** npm ≥ 10 (bundles `node-gyp` ≥ 10 with VS2022 detection
  on Windows).

The `patches/tree-sitter+0.25.0.patch` file goes away once upstream
tree-sitter publishes a release with C++20 set as the default.

## Development

```sh
npm run bootstrap          # first-time only; see "Install" above
npm run build              # tsc to dist/
npm test                   # vitest, ~2s, 33 tests
npm run lint               # tsc --noEmit
```

## Roadmap

- **Phase 1** (this release) — Engine, 8 checks, CLI, terminal/markdown/JSON
  output. Done.
- **Phase 2** — GitLab MR integration (`--gitlab --mr <id>`), self-hosted
  GitLab support, container image on GHCR.
- **Phase 3** — GitHub Action, remaining 10 check categories (POU lifecycle,
  control-flow, style/hygiene), de-duplicated re-runs.
- **Phase 4** (later) — Optional LLM-powered natural-language explanations
  grounded in deterministic findings.

## License

MIT — see [LICENSE](LICENSE).
