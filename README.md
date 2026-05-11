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

Phase 1 — engine, eight checks, CLI, three output formats — is feature-complete
and tested (30 unit tests, all passing). GitLab and GitHub integrations are the
next two phases.

## Quick start (CLI)

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

## Grammar build status (Phase 1 caveat)

`tree-sitter-iec61131-3-st` is not yet published on npm — at the time of this
release, the maintainer is waiting for npm to whitelist the package name. The
project's `package.json` installs it from GitHub:

```json
"tree-sitter-iec61131-3-st": "github:HeytalePazguato/tree-sitter-iec61131-3-st"
```

When installed from GitHub on Windows, the native binding requires:

- Visual Studio 2022 Build Tools (or VS2019 Build Tools with the **C++ Clang
  tools for Windows** component installed — Clang is required by
  `node-addon-api` 8.5+).
- A recent `npm` (≥10), which bundles a modern `node-gyp`.

On Linux/macOS the standard build chain (gcc/clang + make) is sufficient.

Once the grammar is published to npm, the dependency line becomes a normal
semver pin and the build step goes away.

If the binding fails to load, `plc-st-review` surfaces a clear error pointing
to this section.

## Development

```sh
npm install                # see Grammar build status above
npm run build              # tsc to dist/
npm test                   # vitest, ~1.5s, 30 tests
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
