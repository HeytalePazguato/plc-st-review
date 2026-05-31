# Lint mode

`plc-st-review --lint <patterns…>` runs the tool as a **static linter** against a set of `.st` files, with no PR, no base ref, no git diff involved. It's the right mode for industrial ST repos that don't use a PR/MR workflow but still want every push checked for ST bugs.

## What it runs

Lint mode runs the **48 single-revision check categories**: the ones that fire on a single file without comparing it to anything. The 21 diff-based categories are auto-disabled because they have no "before" state to compare against:

| Category | Reason auto-disabled in lint mode |
|---|---|
| `SIGNATURE_CHANGED`, `TYPE_MISMATCH`, `TIMER_VALUE_CHANGED`, `CONSTANT_VALUE_CHANGED`, `COUNTER_VALUE_CHANGED`, `ARRAY_BOUNDS_CHANGED`, `LOOP_BOUNDS_CHANGED`, `INHERITANCE_CHANGED`, `COMMENT_ONLY` | Compare a "before" value to an "after" value, meaningless with no before. |
| `ENUM_VALUE_REMOVED`, `ENUM_VALUE_ADDED`, `ENUM_VALUE_UNUSED`, `POU_DELETED`, `POU_RENAMED`, `METHOD_ADDED_TO_INTERFACE` | Definition of "removed" / "added" / "renamed" requires a before. |
| `PRAGMA_CHANGED`, `UNUSED_VAR_INTRODUCED` | Without a before, these would surface every pragma / every variable as a "new" finding. |

The full list of single-revision categories that **do** fire in lint mode is in the [Checks reference](checks-reference.md): every static, FB-instance, and code-quality check, plus `NAMING_CONVENTION` and `FORBIDDEN_SYMBOL`.

## Patterns

`--lint` accepts a mix of literal paths, directories, and globs:

```sh
plc-st-review --lint MAIN.st                       # one file
plc-st-review --lint src                           # walk a directory
plc-st-review --lint "src/**/*.st"                 # recursive glob
plc-st-review --lint "src/**/*.st" "lib/*.st"      # mix them
plc-st-review --lint "src" --output json           # any output format
```

Quote globs in your shell to stop the shell from expanding them. The CLI expands `*` and `**` itself, so the same command works the same way on Linux, macOS, and PowerShell.

Non-`.st` files matched by a coarse glob are silently skipped, so `src/**/*` is safe even if `src/` mixes `.st` with other files.

## Configuration

Lint mode reads the same `.plc-st-review.yml` as the PR/MR modes:

```yaml
# .plc-st-review.yml
naming_conventions:
  function_block: { prefix: FB_ }
  enum_type:      { prefix: E_ }
  fb_instance:    { prefix: fb }
  bool:           { prefix: x }
  real:           { prefix: r }
  int:            { prefix: i }

forbidden_symbols:
  - gDeprecatedSpeed
```

These rules fire on every push exactly the same way they fire on a PR. See [Naming convention](checks/code-quality/naming_convention.md) and [Forbidden symbol](checks/code-quality/forbidden_symbol.md) for the full configuration reference.

Per-check severity overrides, `disabled_checks`, `ignore_paths`, `safety_critical_prefixes`, and `reporting.fail_on_severity` all apply the same way, see [Tuning severities](tuning-severities.md) and [Preset packs](preset-packs.md).

## CI examples

### GitLab CI

```yaml
lint-st:
  image: ghcr.io/heytalepazguato/plc-st-review:v0
  stage: lint
  script:
    - plc-st-review --lint "src/**/*.st"
```

The job fails when any finding meets `reporting.fail_on_severity` (default `error`), so the pipeline blocks on real bugs.

### GitHub Actions

```yaml
name: lint
on: [push]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx plc-st-review --lint "src/**/*.st"
```

`npx` pulls the npm package on demand. If you'd rather pin a version, use `npx plc-st-review@0.0.1 --lint …`.

### Self-hosted runner (any platform)

The Docker image at `ghcr.io/heytalepazguato/plc-st-review:v0` carries everything the CLI needs (Node + the tree-sitter grammar). On an offline runner, mirror the image to your internal registry once.

## Output formats

Same as the other modes: `terminal` (ANSI when stdout is a TTY), `markdown`, `json`.

```sh
plc-st-review --lint "src/**/*.st" --output json --out-file findings.json
```

The JSON format is the stable contract for downstream tooling. IDE integrations, dashboards, or your own findings aggregator.

## Exit codes

- `0`: no findings at or above the fail-on threshold.
- `1`: at least one finding meets `reporting.fail_on_severity` (default: `error`). The CLI still prints the full findings list before exiting.
- `2`: invalid arguments or an unrecoverable error (bad config, no files matched, etc).
