# Preset packs

`plc-st-review` ships **no opinionated naming or style defaults**: the out-of-the-box config has every per-team rule disabled. Different shops disagree on conventions (some prefix bools with `x`, some suffix enum types with `_enum`, some use both, some neither), and the engine has no business taking a side.

The `extends:` mechanism lets your team compose its own policy and share it across projects, the same way ESLint and Prettier do.

## How extends works

`.plc-st-review.yml` is the project's config file. Anywhere it accepts a value, it also accepts an `extends:` pointing at one or more "preset" files that contribute the same shape:

```yaml
# .plc-st-review.yml at the project root

extends:
  - ./presets/company-standards.yml      # baseline applied to every project
  - ./presets/injection-molding.yml      # vertical-specific overrides

# Local overrides applied last (highest precedence)
disabled_checks:
  - COMMENT_ONLY

naming_conventions:
  fb_instance: { prefix: fbInj }
```

**Rules of resolution:**

- `extends:` accepts a single path or an array. The list is walked in order; entries later in the list override earlier ones.
- Paths can be relative to the file that declares `extends:`, or absolute.
- A preset can itself extend another preset, `extends:` chains as deep as you want.
- The local config (the file you're loading) always overrides any values its presets set.
- Cycles (`a → b → a`) are detected and reported as an error.
- Resolution is **filesystem-only** in v0.x. No npm packages, no HTTP URLs, no git refs. If you want to share presets across repos, vendor them via a git submodule or copy them in.

## Merge semantics by field

| Field | How it merges |
|---|---|
| `extends` | Replaced (not relevant in the merged result) |
| `disabled_checks` | Union, every preset's entry is collected |
| `severity_overrides` | Map merge, later wins |
| `ignore_paths` | Union |
| `safety_critical_prefixes` | Override (last writer wins) |
| `forbidden_symbols` | Union |
| `naming_conventions` | Map merge, later wins on each dimension |
| `naming_ignore` | Union |
| `reporting.*` | Map merge |

## A worked example

Imagine your shop builds two product lines: injection-molding machines and CNC mills. You want a common baseline and a vertical-specific overlay.

```yaml
# presets/company-standards.yml, reused across all projects

# Every team agrees on these.
safety_critical_prefixes:
  - SAFETY_
  - INTERLOCK_

severity_overrides:
  CONSTANT_VALUE_CHANGED: warn

# Naming policy applied to every project. Per-vertical packs can extend
# or override individual dimensions.
naming_conventions:
  bool:            { prefix: x }
  int:             { prefix: i }
  real:            { prefix: r }
  string:          { prefix: s }
  pointer:         { prefix: p }
  enum_type:       { suffix: _enum }
  structure_type:  { suffix: _type }
  fb_instance:     { prefix: fb }
  global_var:      { prefix: g }
  function_block:  { prefix: FB_ }
  function:        { prefix: fn }
```

```yaml
# presets/injection-molding.yml, only the bits that change

# Injection cycle timing is safety-relevant on these machines.
severity_overrides:
  TIMER_VALUE_CHANGED: error

# Naming: machine FB instances get the `fbInj` prefix.
naming_conventions:
  fb_instance: { prefix: fbInj }

# We've never used SR latches in this product line; ban them.
forbidden_symbols:
  - /\\bSR\\b/

# Suppress this, too noisy on the legacy code we inherited.
disabled_checks:
  - BISTABLE_DOMINANCE_MISMATCH
```

```yaml
# presets/cnc.yml, different vertical, different baseline

severity_overrides:
  LOOP_BOUNDS_CHANGED: warn       # spindle programs run lots of FOR loops
  TIMER_VALUE_CHANGED: warn       # not as safety-critical as molding

naming_conventions:
  fb_instance: { prefix: fbCnc }
```

```yaml
# .plc-st-review.yml in a specific repo

# Pick one of the verticals.
extends:
  - ./presets/company-standards.yml
  - ./presets/injection-molding.yml
```

A different repo, different extends:

```yaml
# .plc-st-review.yml in a CNC-mill repo
extends:
  - ./presets/company-standards.yml
  - ./presets/cnc.yml
```

## Sharing presets across repos

Three patterns, in increasing complexity:

1. **Copy**: every project keeps a `presets/` directory; you update them when the standard changes. Lowest friction, highest drift. 2. **Git submodule**: keep `presets/` as a submodule of a shared `standards` repo. One source of truth; updates are explicit per project. 3. **CI-injected**: your CI clones the `standards` repo before running `plc-st-review` and points `extends:` at the checkout. Same single-source-of-truth without per-project submodule plumbing.

There is no "right" answer; pick the one that matches how your team already handles shared standards.

## Shipped presets

Most projects bring their own conventions, so the engine ships **one** opinionated preset:

- **[PLCopen Coding Guidelines](presets/plcopen.md)** — `presets/plcopen.yml`. The closest thing the IEC 61131-3 world has to MISRA-C. Vendor-neutral, standards-body-published. Use it as your baseline if your team doesn't already have one, then layer your own preset on top. See the page for the full PLCopen rule → plc-st-review check mapping and a list of which rules need new checks (gaps) vs. which are out of scope.

## What the engine still does NOT ship

- **No vendor-flavored presets** (no Beckhoff / CODESYS / TwinCAT / ABB / Siemens preset). The engine stays portable; conventions live in your repo or in a standards body's preset like PLCopen.
- **No team-style "recommended" preset.** PLCopen is a standards-body baseline, not "what the maintainer thinks is reasonable." Your team's specific preferences (prefix letters, ignored rules, etc.) go in your own preset.
- **No preset versioning or registry.** Presets are plain YAML files in your control; their lifecycle is part of your project, not the tool.

## Validating a preset

To check that a preset file loads cleanly, point the CLI at it (with no diff target) and let the config loader validate the syntax:

```sh
plc-st-review --config presets/injection-molding.yml --files placeholder.st placeholder.st
```

If the file has invalid YAML, an unknown naming dimension, or a malformed regex, the CLI exits with a clear error.
