# PLCopen Coding Guidelines preset

[**PLCopen Coding Guidelines v1.0**](https://plcopen.org/guidelines/guidelines) is the closest thing the IEC 61131-3 world has to MISRA-C — 60+ rules spanning naming, comments, language constructs, coding practice, and vendor-specific extensions. `plc-st-review` ships a preset that turns on the rules the engine can express **via configuration alone**, and this page is the **mapping table** so you know exactly which PLCopen rules are covered, which need a new check (gap), and which are out of scope for this tool.

The preset targets the **standard, vendor-neutral** PLCopen guidelines — no dialect quirks, no vendor idioms — so it's the right starting point regardless of whether your code is built in CODESYS, TwinCAT, or any other IEC 61131-3 environment.

## How to use it

Add to your `.plc-st-review.yml`:

```yaml
extends:
  - ./presets/plcopen.yml

# Override anything the preset sets if your team disagrees with PLCopen on
# specific rules — `extends` is a baseline, not a straitjacket.
naming_conventions:
  bool: { prefix: b }    # we use `b` instead of PLCopen's `x` for BOOL
```

[How `extends` works.](../preset-packs.md)

## What the preset turns on

The preset is **config-only** — it doesn't add new checks, it tunes the ones that ship. Specifically it:

- Bumps severities on `RECURSIVE_CALL`, `FB_INSTANCE_DOUBLE_CALL` (→ error) and a handful of warn-level rules to reflect PLCopen's recommendations.
- Sets the `metrics.thresholds` for cyclomatic complexity and nesting depth to PLCopen-style strict values (10 / 4 for warn, 20 / 6 for error).
- Configures `naming_conventions` for every dimension (bool → `x`, int → `i`, real → `r`, …; FB-types → `FB_` prefix; constants → `^[A-Z][A-Z0-9_]+$`).

## Mapping table

Legend:

- **mapped** — the rule is enforced by an existing plc-st-review check, configured by this preset.
- **gap** — there is no existing check; a new check would need to be added in plc-st-review (the tree-sitter grammar already exposes the necessary nodes).
- **out of scope** — the rule is outside what this tool can decide (typically: task scheduling, cycle-time semantics, intent / subjective rules).

### Naming (N)

| Rule | Title | Status | How |
|---|---|---|---|
| **N1** | Avoid physical addresses (`%I0.0`, `%Q1.2`) | gap | Grammar emits `direct_address` nodes; needs a new `DIRECT_ADDRESS_USED` check. |
| **N2** | Define type prefixes for variables | mapped | `naming_conventions.{bool,int,real,…}` set by preset. |
| **N4** | Constants in `UPPER_CASE` | mapped | `naming_conventions.constant.pattern = ^[A-Z][A-Z0-9_]+$` set by preset. |
| **N5** | Local names shall not shadow global names | mapped | `VARIABLE_SHADOWING` raised to warn by preset. |
| **N6** | Define an acceptable name length | gap | Would need a length-cap check (or a regex pattern that bakes a length cap into every `naming_conventions.*`). |
| **N9** | Different element types should not bear the same name | gap | Needs a cross-kind name-collision check. |
| **N10** | Naming rules for user-defined types | mapped | `naming_conventions.{enum_type,structure_type}` set by preset. |

### Comment (C)

| Rule | Title | Status | How |
|---|---|---|---|
| **C1** | Comments shall describe intent | out of scope | Intent isn't statically checkable. |
| **C2** | All elements shall be commented | gap | Needs a "POU/var has a leading comment?" coverage check. |
| **C3** | Avoid nested comments | mapped | `NESTED_COMMENTS` raised to warn by preset. |
| **C4** | Comments may not include code | mapped | `COMMENTED_OUT_CODE` raised to warn by preset. |
| **C5** | Use single-line comments | out of scope | Style preference; a formatter does this better than a linter. |

### Language (L) — ST

| Rule | Title | Status | How |
|---|---|---|---|
| **L10** | Forbid `CONTINUE`, `EXIT` (and `GOTO`) | gap | Grammar emits `continue_statement` / `exit_statement` / `goto_statement` nodes; needs a `FORBIDDEN_STATEMENT` check. (`FORBIDDEN_SYMBOL` only matches identifier references and can't catch these.) |
| **L12** | Loop counter variables shall not be modified inside the loop | gap | Needs a check that walks `assignmentTargets` inside a `for_statement` body and matches against the loop variable. |
| **L13** | Loop counter variables shall not be used after the loop | gap | Needs a scope-aware check on the loop variable's uses outside the for body. |
| **L17** | Each `IF` shall have an `ELSE` clause | gap | Grammar exposes `if_statement` children; an `else_clause` named child is absent when there's no else. Straightforward new check. |

### Coding practice (CP)

| Rule | Title | Status | How |
|---|---|---|---|
| **CP1** | Access to a member shall be by name | gap | Same shape as N1 — direct addresses. |
| **CP2** | All code shall be used in the application | mapped | `DEAD_POU_INTRODUCED` (needs `--project-scope` to see callers outside the diff). |
| **CP8** | Floating-point comparison shall not be `=` / `<>` | mapped | `REAL_EQUALITY` raised to warn by preset. |
| **CP9** | Limit POU code complexity | mapped | `metrics.thresholds.cyclomatic_complexity` and `nesting_depth` set by preset. |
| **CP10** | Avoid multiple writes from multiple tasks | out of scope | No task-model awareness. |
| **CP12** | Physical outputs shall be written once per cycle | out of scope | No cycle-time semantics. |
| **CP13** | POUs shall not call themselves directly/indirectly | mapped (direct) / gap (indirect) | `RECURSIVE_CALL` raised to error by preset. Indirect cycles would need a project-wide call-graph cycle check (the call graph already exists for `--metrics`). |
| **CP14** | POUs shall have a single point of exit | mapped | `MULTIPLE_EXIT_POINTS` raised to warn by preset. |
| **CP16** | Tasks shall only call program POUs | out of scope | No task-model awareness. |
| **CP17** | Parameter usage shall match declaration mode | partial | `CALL_SITE_OUTDATED` catches the structural breaks (missing required, unknown arg name); fuller mode-vs-usage matching would be a gap. |
| **CP18** | Limit use of global variables | gap | Subjective "limit" — could be a per-POU global-reference count cap. |
| **CP20** | FB instances should be called only once per cycle | mapped | `FB_INSTANCE_DOUBLE_CALL` raised to error by preset. |
| **CP21** | Use `VAR_TEMP` for temporaries | out of scope | Detecting "which locals could be VAR_TEMP" needs intent / lifetime analysis. |
| **CP22** | Select appropriate data type | out of scope | Subjective; depends on application semantics. |
| **CP23** | Define max number of input/output/in-out variables | gap | Simple count cap; no existing check. |
| **CP24** | Do not declare variables that are not used | mapped | `UNUSED_VAR_INTRODUCED`, `UNUSED_INPUT_VAR`, `UNUSED_OUTPUT_VAR` all raised to warn by preset. |
| **CP25** | Data type conversions shall be explicit | gap | Needs implicit-conversion detection; would benefit from type inference but is doable from the AST. |
| **CP26** | A global variable may be written by only one PROGRAM | out of scope | Cross-program semantics; no PROGRAM-ownership model. |

### Vendor extensions (E)

| Rule | Title | Status | How |
|---|---|---|---|
| **E2** | Pointer arithmetic shall not be used | gap | Doable in the engine: track POINTER-typed variables and flag `binary_expression`s whose operand text matches one. The grammar emits `pointer_type` declarations and `binary_expression` nodes; no upstream change needed. |
| **E3** | Some comparator instructions shall not be used for pointers | gap | Same shape as E2. |

## Summary

| Bucket | Count |
|---|---|
| **mapped** (enforced by this preset) | 11 |
| **partial** | 1 |
| **gap** (new check needed, no grammar change) | 13 |
| **out of scope** (intent / task model / cycle) | 8 |

The preset closes the **11 mapped + 1 partial** today. The **13 gaps** are the natural roadmap for v2 — each is a small new check on existing AST nodes. **No tree-sitter grammar changes are required** for any v1- or v2-scope rule; the grammar already emits `direct_address`, `continue_statement` / `exit_statement` / `goto_statement`, `if_statement` (with optional `else_clause` as a named child), `for_statement`, `pointer_type`, and `binary_expression`, which between them cover every gap rule listed above.

## What the preset deliberately does NOT do

- **It does not pretend to enforce every rule.** The mapping table is the source of truth. If a row says **gap**, the preset does not enforce that rule, no matter how plausible the rule sounds.
- **It does not pick a dialect.** PLCopen guidelines are vendor-neutral; the preset is too. If you want vendor- or team-specific rules on top, layer them via a second `extends:` entry (the [worked example in Preset packs](../preset-packs.md#a-worked-example) shows the pattern).
- **It does not override `case_sensitive`.** PLCopen doesn't speak to dialect case sensitivity. Set [`case_sensitive`](../case-sensitivity.md) to match your toolchain separately.
