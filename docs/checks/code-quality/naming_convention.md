# NAMING_CONVENTION

**Severity:** `warn` (config-driven — off by default)

A declaration name doesn't match the configured prefix, suffix, or
regex for its kind.

**Why it matters.** Naming conventions are how teams keep large
codebases skimmable. The engine doesn't ship any blessed convention —
your team writes the rules in `naming_conventions:`, optionally
composed from shared preset files via `extends:` (see
[`preset-packs.md`](../../preset-packs.md)).

This is a clean and simple way to enforce team or company coding
guidelines without needing a separate style review pass: once
`naming_conventions:` is set in `.plc-st-review.yml`, the PR or MR
itself becomes the enforcement surface. Every non-conforming
identifier shows up as an inline comment on the exact line, so the
guideline lives next to the code instead of in a PDF nobody re-reads.
Reviewers don't have to remember the rules; the bot does. Onboarding
a new engineer means pointing them at the comments the bot leaves,
not at a wiki page.

Typical workflow: agree on the convention once (often distilled from
an existing internal style guide), drop it into `.plc-st-review.yml`
on `main`, and from then on every PR/MR that introduces a
non-conforming name gets an actionable, line-specific note. Grandfather
legacy code in via `naming_ignore:` so the check only enforces new
work — no day-one renaming churn required.

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

Each rule accepts any combination of `prefix`, `suffix`, `pattern` —
all listed must match.

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

**Fix.** Rename to match the convention, or add the identifier to
`naming_ignore:` to grandfather it in.

