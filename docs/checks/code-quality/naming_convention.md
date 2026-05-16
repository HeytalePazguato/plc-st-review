# NAMING_CONVENTION

**Severity:** `warn` (config-driven, off by default)

A declaration name doesn't match the configured prefix, suffix, or regex for its kind.

**Why it matters.** Naming conventions are how teams keep large codebases skimmable. The engine doesn't ship any blessed convention, your team writes the rules in `naming_conventions:`, optionally composed from shared preset files via `extends:` (see [`preset-packs.md`](../../preset-packs.md)).

This is a clean and simple way to enforce team or company coding guidelines without needing a separate style review pass: once `naming_conventions:` is set in `.plc-st-review.yml`, the PR or MR itself becomes the enforcement surface. Every non-conforming identifier shows up as an inline comment on the exact line, so the guideline lives next to the code instead of in a PDF nobody re-reads. Reviewers don't have to remember the rules; the bot does. Onboarding a new engineer means pointing them at the comments the bot leaves, not at a wiki page.

Typical workflow: agree on the convention once (often distilled from an existing internal style guide), drop it into `.plc-st-review.yml` on `main`, and from then on every PR/MR that introduces a non-conforming name gets an actionable, line-specific note. Grandfather legacy code in via `naming_ignore:` so the check only enforces new work, no day-one renaming churn required.

**Settings.** Off by default. Configure per declaration-kind:

```yaml
naming_conventions:
  bool:           { prefix: x }                    # variables of type BOOL
  int:            { prefix: i }
  real:           { prefix: r }
  string:         { prefix: s }
  time:           { prefix: t }
  pointer:        { prefix: p }
  enum_type:      { suffix: _enum }                # TYPE definitions
  structure_type: { suffix: _type }
  function_block: { prefix: FB_ }
  function:       { prefix: fn }
  program:        { prefix: P_ }
  method:         { prefix: m }
  interface:      { prefix: I }
  fb_instance:    { prefix: fb }                   # locals typed as user FBs / TON / CTU / ...
  global_var:     { prefix: g }
  input_var:      { prefix: x }                    # could also use {suffix: _in}
  output_var:     { prefix: x }
  in_out_var:     { prefix: x }
  constant:       { pattern: '^[A-Z][A-Z0-9_]*$' } # SCREAMING_SNAKE_CASE

  # Per-rule severity + case sensitivity
  function_block:
    prefix: FB_
    case: insensitive       # default is sensitive
    severity: warn          # override the default just for this rule

# Identifiers to skip entirely (legacy code, vendor lib names)
naming_ignore:
  - MAIN
  - /^Tc[0-9]+_/             # regex inside slashes
```

**`prefix`, `suffix`, and `pattern` combine with AND.** Each rule can list one, two, or all three at the same time. Whatever you list must *all* hold for the identifier to pass, if any one fails, the check fires. Listing none means the kind is unconstrained.

Three worked examples, simplest to strictest:

```yaml
naming_conventions:

  # 1) Prefix only, anything starting with FB_ passes.
  #    FB_Pump        ✅
  #    Pump           ❌ no prefix
  #    fb_pump        ❌ wrong case (add `case: insensitive` to allow)
  function_block: { prefix: FB_ }

  # 2) Prefix AND suffix, must start with E_ AND end with _enum.
  #    E_State_enum   ✅
  #    E_State        ❌ missing suffix
  #    State_enum     ❌ missing prefix
  enum_type:
    prefix: E_
    suffix: _enum

  # 3) Prefix AND suffix AND pattern, all three checked.
  #    `^[A-Z][A-Za-z0-9]+$` rejects underscores and lowercase starts;
  #    combined with prefix `g` and suffix `_var`, the name must be
  #    `g<CamelChunk>_var`: e.g. `gMaxRetries_var`.
  #
  #    gMaxRetries_var   ✅
  #    gMax_Retries_var  ❌ regex rejects the inner underscore
  #    MaxRetries_var    ❌ missing prefix
  #    gMaxRetries       ❌ missing suffix
  global_var:
    prefix: g
    suffix: _var
    pattern: '^[A-Za-z][A-Za-z0-9]+$'
```

`case: insensitive` only affects `prefix` / `suffix` matching; `pattern` is always a literal JavaScript regex (add `(?i)`-equivalent character classes yourself if you need it case-insensitive). Malformed regexes are silently skipped, the rule effectively becomes prefix / suffix only, so test your patterns.

**Trigger.**

```pascal
FUNCTION_BLOCK Pump                (* fires if function_block.prefix is FB_ *)
```

**The bot posts.**

```
🟧 warn  NAMING_CONVENTION
function_block 'Pump' does not start with 'FB_' (naming convention)
Naming-convention rule failed for this declaration. Tune the rule
under `naming_conventions:` in your `.plc-st-review.yml`, or add
the identifier to `naming_ignore:` if it is grandfathered in.
```

**Fix.** Rename to match the convention, or add the identifier to `naming_ignore:` to grandfather it in.

