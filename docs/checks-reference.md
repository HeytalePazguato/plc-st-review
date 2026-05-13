# Checks reference

Every check `plc-st-review` ships with — what it catches, why it
exists, how to configure it, an ST trigger, what the bot posts, and a
suggested fix. See [`check-limitations.md`](check-limitations.md) for
what each check deliberately *doesn't* catch.

**Live demo:** every check in this document fires at least once on
[PR #1](https://github.com/HeytalePazguato/plc-st-review/pull/1), where
you can see the exact inline comments the bot posts.

## Common settings (apply to every check)

Two knobs work on every check, set in `.plc-st-review.yml`:

```yaml
severity_overrides:
  CATEGORY_NAME: error      # raise / lower the severity for this category
disabled_checks:
  - CATEGORY_NAME           # turn the check off entirely
```

Per-check "Settings" sections below only list **additional** knobs
(check-specific config, prefix lists, etc.).

## Table of contents

- [Diff-based checks](#diff-based-checks) — compare before vs after
  - [SIGNATURE_CHANGED](#signature_changed) ·
    [CALL_SITE_OUTDATED](#call_site_outdated) ·
    [TYPE_MISMATCH](#type_mismatch) ·
    [ENUM_VALUE_REMOVED](#enum_value_removed) ·
    [ENUM_VALUE_ADDED](#enum_value_added) ·
    [TIMER_VALUE_CHANGED](#timer_value_changed) ·
    [CONSTANT_VALUE_CHANGED](#constant_value_changed) ·
    [COMMENT_ONLY](#comment_only)
  - [ARRAY_BOUNDS_CHANGED](#array_bounds_changed) ·
    [STATE_UNHANDLED](#state_unhandled) ·
    [UNREACHABLE_CODE](#unreachable_code) ·
    [LOOP_BOUNDS_CHANGED](#loop_bounds_changed) ·
    [POU_DELETED](#pou_deleted) ·
    [POU_RENAMED](#pou_renamed) ·
    [METHOD_ADDED_TO_INTERFACE](#method_added_to_interface) ·
    [INHERITANCE_CHANGED](#inheritance_changed) ·
    [PRAGMA_CHANGED](#pragma_changed) ·
    [UNUSED_VAR_INTRODUCED](#unused_var_introduced) ·
    [COUNTER_VALUE_CHANGED](#counter_value_changed)
- [Static integrity checks](#static-integrity-checks)
  - [ENUM_VALUE_UNUSED](#enum_value_unused) ·
    [ENUM_MEMBER_UNKNOWN](#enum_member_unknown) ·
    [ARRAY_INDEX_OUT_OF_BOUNDS](#array_index_out_of_bounds) ·
    [DIVISION_BY_ZERO](#division_by_zero) ·
    [INFINITE_LOOP](#infinite_loop) ·
    [LOOP_BOUNDS_REVERSED](#loop_bounds_reversed)
- [FB-instance checks](#fb-instance-checks)
  - [COUNTER_PV_ZERO](#counter_pv_zero) ·
    [TIMER_PT_ZERO](#timer_pt_zero) ·
    [TIMER_NOT_DRIVEN](#timer_not_driven) ·
    [EDGE_TRIG_REUSED](#edge_trig_reused) ·
    [FB_INSTANCE_DOUBLE_CALL](#fb_instance_double_call) ·
    [FB_INSTANCE_NEVER_CALLED](#fb_instance_never_called) ·
    [BISTABLE_DOMINANCE_MISMATCH](#bistable_dominance_mismatch)
- [Code-quality and style checks](#code-quality-and-style-checks)
  - [EMPTY_STATEMENT](#empty_statement) ·
    [UNUSED_RETURN_VALUE](#unused_return_value) ·
    [ARRAY_SINGLE_ELEMENT](#array_single_element) ·
    [VARIABLE_SHADOWING](#variable_shadowing) ·
    [UNQUALIFIED_ENUM_CONSTANT](#unqualified_enum_constant) ·
    [IDENTIFIER_CASE_MISMATCH](#identifier_case_mismatch) ·
    [UNUSED_INPUT_VAR](#unused_input_var) ·
    [INPUT_VAR_WRITTEN](#input_var_written) ·
    [BOOL_COMPARISON](#bool_comparison) ·
    [REAL_EQUALITY](#real_equality) ·
    [MULTIPLE_EXIT_POINTS](#multiple_exit_points) ·
    [ASSIGNMENT_IN_CONDITION](#assignment_in_condition) ·
    [COMMENTED_OUT_CODE](#commented_out_code) ·
    [RECURSIVE_CALL](#recursive_call) ·
    [FORBIDDEN_SYMBOL](#forbidden_symbol) ·
    [ADDRESS_OF_CONSTANT](#address_of_constant) ·
    [UNUSED_OUTPUT_VAR](#unused_output_var) ·
    [OUTPUT_VAR_READ_INTERNALLY](#output_var_read_internally) ·
    [NESTED_COMMENTS](#nested_comments) ·
    [NAMING_CONVENTION](#naming_convention)

---

# Diff-based checks

These compare the "before" and "after" trees of a PR. Every finding
implies a change happened in this PR.

## SIGNATURE_CHANGED

**Severity:** `warn` (`error` on breaking changes)

A POU's inputs, outputs, or in-outs were renamed, removed, or had
their type changed.

**Why it matters.** A signature change ripples to every caller. The
breaking variant (removed / type-changed params, or a new required
input without a default) silently turns previously-passing calls into
type errors at compile time — or worse, into runtime misbehavior on
runtimes that auto-pad missing args. Catching the change at PR review
is much cheaper than chasing it down at install.

**Settings.** Severity is auto-elevated to `error` when the engine
detects a breaking change; `severity_overrides` replaces the entire
scaled severity if set.

**Trigger.**

```pascal
(* before *)                       (* after *)
FUNCTION_BLOCK FB_Pump             FUNCTION_BLOCK FB_Pump
VAR_INPUT                          VAR_INPUT
    xEnable : BOOL;                    xEnable : BOOL;
END_VAR                                xManualOverride : BOOL;  (* no default *)
                                   END_VAR
```

**The bot posts.**

```
🟥 error  SIGNATURE_CHANGED
function_block FB_Pump signature changed (breaking): +1 input
  + VAR_INPUT xManualOverride : BOOL
```

**Fix.** Either give the new input a default (`xManualOverride : BOOL := FALSE;`)
so callers don't have to update, or update every call site explicitly.

## CALL_SITE_OUTDATED

**Severity:** `error`

A caller doesn't pass a required argument that the callee now
requires, or passes an argument name the callee doesn't have. Resolves
FB-instance calls (e.g. `fbConveyor(...)`) through their type back to
the POU.

**Why it matters.** This is the "missing the new arg" half of every
`SIGNATURE_CHANGED` finding. Without it, a `warn` on the FB and an
unrelated `green` on the consumer can ship a real bug.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* FB_Pump gained a required xManualOverride; the caller didn't update: *)
fbPump(xEnable := TRUE, rSetpoint := 50.0);
```

**The bot posts.**

```
🟥 error  CALL_SITE_OUTDATED
Call to FB_Pump is out of date with its signature
Missing required arguments: xManualOverride
```

**Fix.** Add the missing argument or correct the typo. If the new
input shouldn't be the caller's responsibility, add a default to the
callee instead.

## TYPE_MISMATCH

**Severity:** `error`

A `VAR_GLOBAL` declaration's type changed between revisions.

**Why it matters.** Global type changes often pass compile (especially
between numerically-similar types like `INT` and `WORD`) but produce
silent precision loss or sign-bit surprises at runtime. Listing every
file that references the global makes the cleanup scope obvious in
review.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before *)                       (* after *)
VAR_GLOBAL                         VAR_GLOBAL
    gFlow : REAL := 0.0;               gFlow : INT := 0;
END_VAR                            END_VAR
```

**The bot posts.**

```
🟥 error  TYPE_MISMATCH
Global 'gFlow' type changed: REAL → INT
Callers in 3 files may need updating.
```

**Fix.** Revert the type, or update every reader / writer to match.

## ENUM_VALUE_REMOVED

**Severity:** `error`

A `CASE` statement in some other file still references an enum value
that was removed from the enum.

**Why it matters.** Removing an enum value is a refactor; failing to
update every CASE on that enum is a compile failure that the engine
catches across files even when the offending CASE wasn't touched in
this PR.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before: TYPE E_State : (IDLE, RUNNING, FAULT); END_TYPE *)
(* after:  TYPE E_State : (IDLE, RUNNING);        END_TYPE *)

(* Conveyor_HMI.st, unchanged in this PR: *)
CASE eState OF
    E_State.IDLE: ...
    E_State.FAULT: ...   (* fires — value no longer exists *)
END_CASE;
```

**The bot posts.**

```
🟥 error  ENUM_VALUE_REMOVED
CASE references removed enum value E_State.FAULT
E_State.FAULT was removed from the enum at E_State.st:5
```

**Fix.** Restore the enum value, or update the CASE to drop the
reference.

## ENUM_VALUE_ADDED

**Severity:** `warn`

An enum gained a value and a `CASE` on that enum (in any file) has no
matching branch and no `ELSE`.

**Why it matters.** Adding a new state without updating every consumer
is the most common state-machine bug. The check is the inverse of
ENUM_VALUE_REMOVED — both directions need surveillance.

**Settings.** No check-specific config. See also `STATE_UNHANDLED`,
which fires on the same shape even when the enum hasn't changed.

**Trigger.**

```pascal
(* before: TYPE E_State : (IDLE, RUNNING); END_TYPE *)
(* after:  TYPE E_State : (IDLE, RUNNING, ERROR_RECOVERY); END_TYPE *)

CASE eState OF
    E_State.IDLE: ...
    E_State.RUNNING: ...
END_CASE;                        (* fires — no ERROR_RECOVERY branch, no ELSE *)
```

**The bot posts.**

```
🟧 warn  ENUM_VALUE_ADDED
CASE does not handle new enum value(s): E_State.ERROR_RECOVERY
Enum E_State gained 1 value(s); this CASE has no ELSE branch.
```

**Fix.** Add the missing branch, or add an `ELSE` that handles
unknown states.

## TIMER_VALUE_CHANGED

**Severity:** `info` / `warn` (≥ 2×) / `error` (≥ 10×)

A `TON` / `TOF` / `TP` `PT` value changed between revisions. Severity
scales with the magnitude of the change.

**Why it matters.** Timer changes are easy to miss in code review
because they look like trivial literal edits, but a 10× faster PT can
turn a safety debounce into a flicker. The scaled severity makes the
"oh that's just 200ms" change loud when it actually matters.

**Settings.**

```yaml
severity_overrides:
  TIMER_VALUE_CHANGED: error   # block merge on any timer change
```

**Trigger.**

```pascal
T_StartupDelay(IN := TRUE, PT := T#5s);     (* before *)
T_StartupDelay(IN := TRUE, PT := T#500ms);  (* after *)
```

**The bot posts.**

```
🟥 error  TIMER_VALUE_CHANGED
Timer T_StartupDelay.PT: T#5s → T#500ms (10.0x faster)
Ratio after/before ≈ 0.100. Confirm the change was intentional.
```

**Fix.** Confirm the new value is the intended one. If you're tuning,
mention the rationale in the PR description. If unintended, revert.

## CONSTANT_VALUE_CHANGED

**Severity:** `info` (`warn` when name matches a safety-critical prefix)

A `VAR_GLOBAL CONSTANT`'s initial value changed.

**Why it matters.** Constants encode design assumptions (max speed,
trip thresholds, retry counts). Changing one without a note in the PR
often surfaces months later as a regression. The safety-prefix bump
catches the high-risk cases automatically.

**Settings.** `safety_critical_prefixes` (default:
`SAFETY_, INTERLOCK_, SIL_, LIMIT_, MAX_, MIN_`) controls which
identifiers elevate to `warn`.

```yaml
safety_critical_prefixes:
  - SAFETY_
  - SIL_
  - EMERGENCY_
```

**Trigger.**

```pascal
(* before *)                              (* after *)
VAR_GLOBAL CONSTANT                       VAR_GLOBAL CONSTANT
    SAFETY_TIMEOUT : TIME := T#2s;            SAFETY_TIMEOUT : TIME := T#10s;
END_VAR                                   END_VAR
```

**The bot posts.**

```
🟧 warn  CONSTANT_VALUE_CHANGED
Constant SAFETY_TIMEOUT: T#2s → T#10s
Identifier prefix matches a safety-critical pattern;
double-check the change is approved.
```

**Fix.** If documented and reviewed, suppress with `disabled_checks`
or tune `safety_critical_prefixes`. Otherwise revert.

## COMMENT_ONLY

**Severity:** `info`

The file's AST is structurally identical between revisions; only
comments or whitespace changed.

**Why it matters.** Lets reviewers skim past files that won't change
behavior. Pair-aware: only triggers when the two ASTs match — a
single-character semantic change defeats it.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before *)                       (* after *)
(* old comment *)                  (* new comment *)
FUNCTION_BLOCK FB_Steady           FUNCTION_BLOCK FB_Steady
END_FUNCTION_BLOCK                 END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟦 info  COMMENT_ONLY
Only comments changed in this file
AST structure is identical between revisions.
```

**Fix.** None needed — informational.

## ARRAY_BOUNDS_CHANGED

**Severity:** `error` (shrink) / `warn` (grow)

An `ARRAY [a..b] OF T` declaration's bounds changed.

**Why it matters.** Shrinking an array means any indexed access at
the old upper bound is now out of range; growing it changes memory
layout and may invalidate hard-coded loop bounds in callers.

**Settings.** No check-specific config.

**Trigger.**

```pascal
arr : ARRAY [0..9] OF INT;     (* before *)
arr : ARRAY [0..4] OF INT;     (* after — shrunk, error *)
```

**The bot posts.**

```
🟥 error  ARRAY_BOUNDS_CHANGED
Array arr bounds: [0..9] → [0..4]
Array shrank — any indexed access that hit the old upper bound is
now out of range.
```

**Fix.** Ensure every accessor uses indices within the new range, or
keep the old size.

## STATE_UNHANDLED

**Severity:** `info`

A `CASE` on an enum has no `ELSE` and doesn't cover every enum value,
regardless of whether the enum changed in this PR.

**Why it matters.** Catches incomplete CASE statements that
`ENUM_VALUE_ADDED` doesn't — gaps that existed from day one or that
were missed during a previous refactor.

**Settings.** No check-specific config.

**Trigger.**

```pascal
TYPE E_State : (IDLE, RUNNING, FAULT); END_TYPE

CASE eState OF
    E_State.IDLE: ...
    E_State.RUNNING: ...
END_CASE;                          (* fires — FAULT not handled, no ELSE *)
```

**The bot posts.**

```
🟦 info  STATE_UNHANDLED
CASE on E_State is missing branches for 1 value(s) and has no ELSE
Unhandled: E_State.FAULT
```

**Fix.** Add the missing branches, or add an `ELSE` that handles
unknown states explicitly.

## UNREACHABLE_CODE

**Severity:** `warn`

A statement was newly placed after `RETURN` / `EXIT` / `CONTINUE` in
the same block.

**Why it matters.** Either the terminator is in the wrong place or
the trailing statement is wrong. Both are bugs; both compile clean.

**Settings.** No check-specific config.

**Trigger.**

```pascal
RETURN;
iCount := 99;                      (* fires — unreachable *)
```

**The bot posts.**

```
🟧 warn  UNREACHABLE_CODE
Unreachable statement after RETURN
In scope FB_Diagnostics. Either remove the statement or move the
terminator after it.
```

**Fix.** Remove the statement, or move the terminator after it.

## LOOP_BOUNDS_CHANGED

**Severity:** `info` (default) / `warn` (≥ 10× iteration change)

A `FOR` loop's start / end / step changed. Resolves
`VAR_GLOBAL CONSTANT` identifiers in the bounds to numeric values
before comparing.

**Why it matters.** A 10× increase in iteration count can move a
control loop from "fits in scan" to "blows the watchdog". The ratio
calc makes the magnitude visible at a glance.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FOR i := 1 TO 10 BY 1 DO ...    (* before *)
FOR i := 1 TO 100 BY 1 DO ...   (* after — 10× iterations *)
```

**The bot posts.**

```
🟧 warn  LOOP_BOUNDS_CHANGED
FOR loop bounds: 1..10 BY 1 → 1..100 BY 1
Iterations: 10 → 100 (10.0×)
```

**Fix.** Confirm the iteration count fits within your scan time
budget. If yes, suppress per-file. If no, cap the loop or split the
work across scans.

## POU_DELETED

**Severity:** `error` (with surviving callers) / `warn` (no callers)

A POU was deleted; the engine cross-checks the new revision for
surviving call sites.

**Why it matters.** The compiler tells you about callers; the engine
beats it to the answer at PR-review time. Severity downgrades when
there are no callers — that's a clean retirement.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* FB_Pump deleted from the codebase but MAIN.st still calls it: *)
fbPump(xEnable := TRUE);
```

**The bot posts.**

```
🟥 error  POU_DELETED
Call to deleted function_block FB_Pump
FB_Pump no longer exists in the new revision.
```

**Fix.** Restore the POU or update / delete the surviving call sites.

## POU_RENAMED

**Severity:** `info`

Heuristic: a deleted POU plus an added POU with an identical
signature in the same PR. Suggests a rename refactor.

**Why it matters.** Sometimes the engine sees "POU_DELETED" + "new
function block declared" — and these are the same thing. The
heuristic surfaces the likely intent so reviewers don't chase a
false alarm.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before *)                          (* after *)
FUNCTION_BLOCK FB_Old                 FUNCTION_BLOCK FB_New
VAR_INPUT                             VAR_INPUT
    xEnable : BOOL;                       xEnable : BOOL;
END_VAR                               END_VAR
END_FUNCTION_BLOCK                    END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟦 info  POU_RENAMED
Possible rename: FB_Old → FB_New
Both POUs share the same kind and signature.
```

**Fix.** If it was a rename, update every call site. If they're
actually different POUs that happen to share a signature, ignore.

## METHOD_ADDED_TO_INTERFACE

**Severity:** `error`

An `INTERFACE` gained a method but a `FUNCTION_BLOCK` that
`IMPLEMENTS` it doesn't declare one.

**Why it matters.** The compiler eventually catches this, but only
when the interface is actually used. The check surfaces it at PR
review so the implementer can be updated in the same PR.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before: INTERFACE IDrivable METHOD Start END_METHOD END_INTERFACE *)
(* after: gained METHOD Stop *)

FUNCTION_BLOCK FB_Pump IMPLEMENTS IDrivable
    METHOD Start ... END_METHOD
    (* no Stop method — fires *)
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟥 error  METHOD_ADDED_TO_INTERFACE
FB_Pump does not implement new method(s) on IDrivable: Stop
Implementing FBs must declare matching methods.
```

**Fix.** Add the missing method to every implementer, or revert
the interface change.

## INHERITANCE_CHANGED

**Severity:** `warn`

An `EXTENDS` clause was added, removed, or changed.

**Why it matters.** A new base brings new methods, possibly with
different bodies than expected; removing one orphans `super`
references. The check makes the change loud.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Derived EXTENDS FB_OldBase     (* before *)
FUNCTION_BLOCK FB_Derived EXTENDS FB_NewBase     (* after — fires *)
```

**The bot posts.**

```
🟧 warn  INHERITANCE_CHANGED
FB_Derived EXTENDS clause changed: FB_OldBase → FB_NewBase
Derived behavior may have changed. Verify that the new base provides
the expected methods and that overrides still align.
```

**Fix.** Walk every overridden method to make sure it still applies
to the new base. Smoke-test on a representative input.

## PRAGMA_CHANGED

**Severity:** `info`

The set of pragmas in a file is different from the previous revision.

**Why it matters.** Pragmas (`{attribute '...'}`) often control
codegen, retention, persistence, build-task assignment — invisible
to the language but loud in the binary. Worth a glance.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before *)                  (* after *)
{attribute 'no_check'}        {attribute 'noinit'}
FUNCTION_BLOCK FB             FUNCTION_BLOCK FB
END_FUNCTION_BLOCK            END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟦 info  PRAGMA_CHANGED
Pragma(s) changed in FB.st (1 added, 1 removed)
  + {attribute 'noinit'}
  - {attribute 'no_check'}
```

**Fix.** Confirm the new pragma set matches the intent. Suppress
per-repo if your team uses pragmas heavily and the noise dominates.

## UNUSED_VAR_INTRODUCED

**Severity:** `info`

A new local variable was declared in this PR but isn't referenced
anywhere in its scope.

**Why it matters.** A leftover from a refactor that never finished,
or a placeholder that someone forgot to wire up. Cheap to flag,
cheap to fix.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* new in this PR: *)
VAR
    iUnused : INT;
END_VAR
```

**The bot posts.**

```
🟦 info  UNUSED_VAR_INTRODUCED
Variable iUnused introduced in FB_X but not referenced
Either remove the declaration or add a use of it.
```

**Fix.** Remove the declaration or add the missing reference.

## COUNTER_VALUE_CHANGED

**Severity:** `info` / `warn` (≥ 2×) / `error` (≥ 10×)

`CTU` / `CTD` / `CTUD` `PV` (preset value) changed between revisions.
Severity scales with the magnitude of the change, like
`TIMER_VALUE_CHANGED`.

**Why it matters.** Counters define trip points (max retries, batch
size, fault thresholds). Bumping `PV` from 3 to 30 changes the
machine's behavior on day one of production.

**Settings.** No check-specific config.

**Trigger.**

```pascal
C1(CU := xPulse, PV := 10);    (* before *)
C1(CU := xPulse, PV := 100);   (* after — 10× *)
```

**The bot posts.**

```
🟥 error  COUNTER_VALUE_CHANGED
Counter C1.PV: 10 → 100 (10.00×)
Magnitude ratio 10.000. Counter trips later as a result.
```

**Fix.** Confirm the new preset is intended. Document the rationale
in the PR.

---

# Static integrity checks

Single-revision checks that catch bugs in the new code regardless of
whether the PR introduced them. Each filters to "new in this PR" by
default — adoption on a legacy repo doesn't dump a wall of
pre-existing findings on day one.

## ENUM_VALUE_UNUSED

**Severity:** `info`

An enum value is declared but no longer referenced in any CASE or
member access in the repo.

**Why it matters.** Dead states accumulate. They're noise to the
reader and risk a typo (someone writes `E_State.OBSOLETE` thinking
it's still active). Surfacing them prompts a cleanup decision.

**Settings.** No check-specific config.

**Trigger.**

```pascal
TYPE E_State : (IDLE, RUNNING, ARCHIVED); END_TYPE
(* no code anywhere references E_State.ARCHIVED *)
```

**The bot posts.**

```
🟦 info  ENUM_VALUE_UNUSED
Enum value E_State.ARCHIVED is no longer referenced anywhere
Either remove the value from the enum if it is genuinely obsolete,
or add a CASE branch that handles it.
```

**Fix.** Remove the value, or add the missing reference.

## ENUM_MEMBER_UNKNOWN

**Severity:** `error`

A qualified reference like `E_State.IDEL` doesn't match any declared
member of `E_State`. Likely a typo. The detail lists the actual
members as candidates.

**Why it matters.** Catches a common typo class (transposition,
missing letter, wrong casing on case-sensitive runtimes) before it
compiles fine due to misleading defaults.

**Settings.** No check-specific config.

**Trigger.**

```pascal
TYPE E_State : (IDLE, RUNNING, FAULT); END_TYPE

eState := E_State.IDEL;            (* typo — fires *)
```

**The bot posts.**

```
🟥 error  ENUM_MEMBER_UNKNOWN
Unknown enum member E_State.IDEL
Enum E_State has values: IDLE, RUNNING, FAULT. Likely typo.
```

**Fix.** Correct the typo.

## ARRAY_INDEX_OUT_OF_BOUNDS

**Severity:** `error`

A literal index sits outside the array's declared bounds. Dynamic
indices (variables, expressions) aren't checked — would need flow
analysis.

**Why it matters.** Compile-time bounds checking catches the obvious
case; runtime crashes do the rest. Catching the literal-index variant
at PR-review time eliminates the cheap mistakes.

**Settings.** No check-specific config.

**Trigger.**

```pascal
arr : ARRAY [0..9] OF INT;
arr[15] := 1;                      (* fires *)
```

**The bot posts.**

```
🟥 error  ARRAY_INDEX_OUT_OF_BOUNDS
arr[15] is out of declared bounds [0..9]
Only literal indices are checked; dynamic indices (variables)
require flow analysis and are skipped.
```

**Fix.** Correct the index, or grow the array.

## DIVISION_BY_ZERO

**Severity:** `error`

The divisor is a literal `0` or a `VAR_GLOBAL CONSTANT` resolving to
zero.

**Why it matters.** Division by zero traps at runtime on most PLC
runtimes, halting the program. The cheap literal cases are the
easiest to catch and the most embarrassing to ship.

**Settings.** No check-specific config.

**Trigger.**

```pascal
rResult := rInput / 0;             (* fires *)
rResult := rInput / cZero;         (* fires if cZero resolves to 0 *)
```

**The bot posts.**

```
🟥 error  DIVISION_BY_ZERO
Division by zero (divisor: 0)
Constant divisor resolves to 0. Dynamic divisors (variables
computed at runtime) are not checked.
```

**Fix.** Use a non-zero divisor, or guard with
`IF cZero <> 0 THEN ... END_IF;`.

## INFINITE_LOOP

**Severity:** `error`

`WHILE TRUE` (or `WHILE 1`) with no `EXIT` inside the body.

**Why it matters.** On a PLC scan, an infinite loop blocks the rest
of the program forever, eventually tripping the watchdog. Easy to
write by accident, catastrophic in production.

**Settings.** No check-specific config.

**Trigger.**

```pascal
WHILE TRUE DO
    iCounter := iCounter + 1;      (* fires — no EXIT *)
END_WHILE;
```

**The bot posts.**

```
🟥 error  INFINITE_LOOP
WHILE TRUE loop with no EXIT statement
On a PLC scan, an infinite loop blocks the rest of the program
forever. Either add EXIT inside the body or convert to a
state-driven structure.
```

**Fix.** Add an `EXIT` condition, or convert to a state machine that
runs one iteration per scan.

## LOOP_BOUNDS_REVERSED

**Severity:** `error`

A `FOR` loop's bounds and step point opposite directions: positive
step with `start > end`, or negative step with `start < end`.

**Why it matters.** Per IEC 61131-3 the body never runs (the
condition is false on entry). On runtimes that wrap integer overflow,
the loop runs hundreds of times before the counter comes back around
to the end value — a runaway loop disguised as a no-op.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FOR i := 10 TO 5 BY 1 DO ...       (* fires — positive step, start > end *)
FOR i := 1 TO 10 BY -1 DO ...      (* fires — negative step, start < end *)
```

**The bot posts.**

```
🟥 error  LOOP_BOUNDS_REVERSED
FOR loop bounds and step disagree: start (10) > end (5) with
positive step (1)
Per IEC 61131-3 the body never executes; on PLC runtimes that
wrap integer overflow the loop runs many more times than intended.
```

**Fix.** Swap `start` and `end`, or invert the `BY` direction.

---

# FB-instance checks

These target the standard IEC 61131-3 function-block instances —
timers, counters, edge triggers, bistables — and their usage
patterns.

## COUNTER_PV_ZERO

**Severity:** `error`

A `CTU` / `CTD` / `CTUD` is initialized with `PV := 0`.

**Why it matters.** A preset of 0 makes the counter trip immediately
on `CTU` (Q is TRUE the first scan) or never on `CTD` (CV can't go
below 0). Either way the counter isn't useful.

**Settings.** No check-specific config.

**Trigger.**

```pascal
C1(CU := xPulse, PV := 0);         (* fires *)
```

**The bot posts.**

```
🟥 error  COUNTER_PV_ZERO
Counter C1.PV resolves to zero (value: 0)
A preset of 0 makes the counter trip immediately on the first
count or never count at all, depending on type.
```

**Fix.** Set a positive preset, or remove the counter if it isn't
needed.

## TIMER_PT_ZERO

**Severity:** `error`

A `TON` / `TOF` / `TP` is set with `PT := T#0s`, or a constant that
resolves to zero.

**Why it matters.** `PT = 0` fires immediately on `TON` / `TP` (the
delay is zero) or never on `TOF` (the off-delay is zero). Almost
always the wrong intent.

**Settings.** No check-specific config.

**Trigger.**

```pascal
T1(IN := xEnable, PT := T#0s);     (* fires *)
```

**The bot posts.**

```
🟥 error  TIMER_PT_ZERO
Timer T1.PT resolves to T#0s (value: T#0s)
A PT of zero either fires immediately (TON/TP) or never (TOF on
falling edge), neither of which is usually intended.
```

**Fix.** Set a non-zero `PT`.

## TIMER_NOT_DRIVEN

**Severity:** `warn`

A timer instance's `.Q` or `.ET` output is read elsewhere in the POU,
but no call site for that instance has an `IN` named argument.

**Why it matters.** A common pattern bug — the timer is called once
without `IN`, then `Q` is sampled. `Q` stays at its initial value
forever; the surrounding logic silently misfires.

**Settings.** No check-specific config.

**Trigger.**

```pascal
T1(PT := T#5s);                    (* IN missing *)
IF T1.Q THEN ...                   (* will always read FALSE *)
```

**The bot posts.**

```
🟧 warn  TIMER_NOT_DRIVEN
Timer T1 (TON) has its Q/ET read but no call sets IN
The timer is invoked but never with a named `IN := ...` argument.
Q will stay at its initial value.
```

**Fix.** Add `IN := <condition>` to the timer call.

## EDGE_TRIG_REUSED

**Severity:** `error`

The same `R_TRIG` / `F_TRIG` instance is invoked with two or more
different `CLK` expressions across the POU.

**Why it matters.** Edge triggers hold internal state ("was CLK
TRUE last scan?"). Swapping the CLK between scans scrambles the
edge detection — sometimes Q fires on the wrong transition,
sometimes it doesn't fire at all.

**Settings.** No check-specific config.

**Trigger.**

```pascal
rTrig(CLK := xButton);
rTrig(CLK := xSensor);             (* fires — same instance, different CLK *)
```

**The bot posts.**

```
🟥 error  EDGE_TRIG_REUSED
R_TRIG instance rTrig is reused with 2 different CLK expressions
CLK values seen: xButton, xSensor. An edge-trigger holds internal
state; mixing inputs scrambles the edge detection. Declare one
instance per CLK source.
```

**Fix.** Declare a separate `R_TRIG` / `F_TRIG` instance per input
signal.

## FB_INSTANCE_DOUBLE_CALL

**Severity:** `warn`

The same FB instance is invoked more than once within one POU's scan.

**Why it matters.** FB instances hold state between calls. Two calls
in one scan means the second overwrites outputs the first produced,
plus any internal counters / timers tick twice per scan.

**Settings.** No check-specific config.

**Trigger.**

```pascal
T1(IN := xA, PT := T#1s);
T1(IN := xB, PT := T#1s);          (* fires *)
```

**The bot posts.**

```
🟧 warn  FB_INSTANCE_DOUBLE_CALL
FB instance T1 called 2 times in FB_Diagnostics
An FB instance holds state between calls. Multiple calls in one
scan overwrite outputs from earlier calls. Lines: 68, 71.
```

**Fix.** Use one instance per call site, or consolidate the calls
behind a single condition.

## FB_INSTANCE_NEVER_CALLED

**Severity:** `warn`

An FB instance is declared, its outputs are read somewhere in the
POU, but no call site invokes it.

**Why it matters.** Outputs only update when the instance is called.
Reading `T1.Q` without ever calling `T1(...)` returns stale data
(usually the initial value forever).

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR
    T1 : TON;
END_VAR
(* no T1(...) call anywhere *)
IF T1.Q THEN ...                   (* fires — T1.Q read but T1 never invoked *)
```

**The bot posts.**

```
🟧 warn  FB_INSTANCE_NEVER_CALLED
FB instance T1 (TON) is read but never invoked
Outputs of an FB only update when the instance is called.
```

**Fix.** Add a call site for the instance, or remove the declaration
if it isn't needed.

## BISTABLE_DOMINANCE_MISMATCH

**Severity:** `info` (heuristic)

Variable naming hints at the wrong bistable dominance. `SR` is
set-dominant; `RS` is reset-dominant. Names containing `eStop`,
`reset`, `trip`, `fault`, `safety`, `lock` suggest reset-dominant
(`RS`); names containing `set`, `latch`, `enable`, `start`, `arm`
suggest set-dominant (`SR`).

**Why it matters.** Pure heuristic — names lie, conventions vary.
But on the codebases where naming is disciplined, mismatched
dominance is usually a real bug, and the false-positive rate is
manageable.

**Settings.** Disable per-repo if your shop's naming doesn't match
the heuristic's word lists:

```yaml
disabled_checks:
  - BISTABLE_DOMINANCE_MISMATCH
```

**Trigger.**

```pascal
eStopLatch : SR;                   (* fires — name suggests reset-dominant *)
```

**The bot posts.**

```
🟦 info  BISTABLE_DOMINANCE_MISMATCH
eStopLatch is SR but its name suggests RS
(set-dominant vs reset-dominant)
```

**Fix.** Either change the type to match the intent (`SR` → `RS` or
vice versa), or rename the variable.

---

# Code-quality and style checks

These flag patterns the engine considers questionable. All filter to
"new in this PR" so legacy code doesn't get re-flagged on every
review.

## EMPTY_STATEMENT

**Severity:** `info`

A lone `;` with nothing in front.

**Why it matters.** Usually leftover from a copy-paste or a debugger
session. Costs nothing to remove and tightens the diff for the next
reviewer.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF xCondition THEN
    ;                              (* fires *)
END_IF;
```

**The bot posts.**

```
🟦 info  EMPTY_STATEMENT
Empty statement (lone `;`)
An empty statement does nothing. Either remove it or replace it
with an explicit comment if the position is intentional.
```

**Fix.** Remove the statement, or replace with
`(* intentionally empty *)` if a placeholder is needed.

## UNUSED_RETURN_VALUE

**Severity:** `info`

A function (POU with a return type) is invoked as a bare statement,
discarding the result.

**Why it matters.** Either the call was for side effects (which
functions in IEC ST shouldn't really have) or the return value
should be used. Both warrant a closer look.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION Compute : INT
    Compute := 42;
END_FUNCTION

Compute();                         (* fires — return value discarded *)
```

**The bot posts.**

```
🟦 info  UNUSED_RETURN_VALUE
Return value of Compute() (declared INT) is discarded
Calling a function as a bare statement throws away its result.
Assign it to a variable or use the value in an expression.
```

**Fix.** Assign the result (`iResult := Compute();`), or use it in
an expression.

## ARRAY_SINGLE_ELEMENT

**Severity:** `info`

`ARRAY [n..n] OF T` — bounds are equal, only one element.

**Why it matters.** Either the bounds are wrong or a scalar would
be clearer. Almost always a copy-paste artifact.

**Settings.** No check-specific config.

**Trigger.**

```pascal
arr : ARRAY [5..5] OF INT;         (* fires *)
```

**The bot posts.**

```
🟦 info  ARRAY_SINGLE_ELEMENT
Array arr declared with a single element [5..5]
An array of length one is usually a mistake.
```

**Fix.** Use a scalar (`arr : INT;`) or correct the bounds.

## VARIABLE_SHADOWING

**Severity:** `warn`

A local variable has the same name as a `VAR_GLOBAL`. The local
hides the global inside this POU.

**Why it matters.** "Why isn't the global updating?" turns into a
30-minute debugging session. The local wins inside the POU; readers
two months later can't tell which one is meant.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_GLOBAL
    gFlow : REAL;
END_VAR

FUNCTION_BLOCK FB_Pump
VAR
    gFlow : REAL;                  (* fires — shadows global *)
END_VAR
```

**The bot posts.**

```
🟧 warn  VARIABLE_SHADOWING
gFlow (var_local) shadows a global of the same name
```

**Fix.** Rename the local, or remove it if the intent was to use the
global.

## UNQUALIFIED_ENUM_CONSTANT

**Severity:** `info`

A bare identifier reference matches a member of exactly one enum
type. Qualified form (`E_State.IDLE`) is clearer than the bare form
(`IDLE`).

**Why it matters.** Bare enum refs work because IEC ST hoists enum
members into scope, but they hide the type from anyone reading the
code and break grep / IDE refactoring.

**Settings.** No check-specific config.

**Trigger.**

```pascal
TYPE E_State : (IDLE, RUNNING); END_TYPE

eState := IDLE;                    (* fires — should be E_State.IDLE *)
```

**The bot posts.**

```
🟦 info  UNQUALIFIED_ENUM_CONSTANT
'IDLE' looks like an enum member; consider writing it qualified
as E_State.IDLE
```

**Fix.** Qualify with the enum type name.

## IDENTIFIER_CASE_MISMATCH

**Severity:** `warn`

A reference uses a different case than the declaration. IEC ST
identifiers are case-insensitive, but inconsistent casing hurts
readability and breaks tools that aren't case-folding.

**Why it matters.** `iCount` vs `icount` vs `Icount` in the same
file is a real maintenance smell. Pick a spelling at declaration
time and stick to it.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR
    iCount : INT;
END_VAR

icount := icount + 1;              (* fires — both refs wrong-cased *)
```

**The bot posts.**

```
🟧 warn  IDENTIFIER_CASE_MISMATCH
'icount' uses a different case than its declaration 'iCount'
```

**Fix.** Match the declared spelling.

## UNUSED_INPUT_VAR

**Severity:** `info`

A `VAR_INPUT` parameter is declared but never read inside the POU
body.

**Why it matters.** Either the input was added speculatively and
forgotten, or the consuming logic was deleted and the input left
behind. Either way it pollutes the interface.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Pump
VAR_INPUT
    xEnable : BOOL;
    xUnused : BOOL;                (* fires — never used *)
END_VAR
```

**The bot posts.**

```
🟦 info  UNUSED_INPUT_VAR
VAR_INPUT xUnused in FB_Pump is never read in the POU body
Either remove the input or replace its usages with the actual
logic that should have consumed it.
```

**Fix.** Remove the input, or add the logic that should have used
it.

## INPUT_VAR_WRITTEN

**Severity:** `warn`

A `VAR_INPUT` parameter is assigned inside the POU.

**Why it matters.** Writing to an input breaks the input/output
contract — the caller's value is gone on the next scan because the
caller will rewrite it. Almost always a sign of confused intent.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_INPUT
    rTarget : REAL;
END_VAR

rTarget := 100.0;                  (* fires *)
```

**The bot posts.**

```
🟧 warn  INPUT_VAR_WRITTEN
VAR_INPUT rTarget is being assigned inside FB_Pump
Writing to an input variable hides changes from the caller and
breaks the input-output contract. Use a local variable instead.
```

**Fix.** Copy into a local variable and modify the local.

## BOOL_COMPARISON

**Severity:** `info`

A BOOL variable is compared with `= TRUE` or `= FALSE`. The
comparison adds no information.

**Why it matters.** Style nit — `IF b THEN` is universally clearer
than `IF b = TRUE THEN`, and the latter sometimes hides intent in
nested logic.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF xEnable = TRUE THEN ...         (* fires *)
IF xEnable = FALSE THEN ...        (* fires *)
```

**The bot posts.**

```
🟦 info  BOOL_COMPARISON
Comparison against a boolean literal (e.g. `IF b = TRUE`)
A BOOL variable is already true/false. `IF b` and `IF NOT b` are
clearer than `IF b = TRUE` / `IF b = FALSE`.
```

**Fix.** Drop the comparison: `IF xEnable THEN` or `IF NOT xEnable
THEN`.

## REAL_EQUALITY

**Severity:** `warn`

`=` or `<>` against a `REAL` / `LREAL` literal. Floating-point
arithmetic almost never produces the exact bit pattern of a literal,
so the comparison is unreliable.

**Why it matters.** Classic floating-point trap. The expression
*looks* obvious but can return FALSE for values you'd consider equal,
and TRUE for values you'd consider different.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF rValue = 0.5 THEN ...                       (* fires *)
IF ABS(rValue - 0.5) < 1.0E-6 THEN ...         (* reliable *)
```

**The bot posts.**

```
🟧 warn  REAL_EQUALITY
Exact equality comparison against a REAL/LREAL literal
Floating-point arithmetic almost never produces the exact bit
pattern of a literal. Compare against a tolerance band.
```

**Fix.** Compare against a tolerance band, or convert to a
fixed-point integer before comparing.

## MULTIPLE_EXIT_POINTS

**Severity:** `info`

A POU has more than one `RETURN`.

**Why it matters.** Multiple exits make control flow harder to
trace and tend to accumulate dead code or duplicate cleanup. Not
universally bad — but worth flagging once you have 3+.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION Choose : INT
    IF xFastPath THEN
        Choose := 1;
        RETURN;                    (* exit 1 *)
    END_IF;
    Choose := 2;
    RETURN;                        (* exit 2 — fires *)
END_FUNCTION
```

**The bot posts.**

```
🟦 info  MULTIPLE_EXIT_POINTS
Choose has 2 RETURN statements
Multi-exit POUs are harder to reason about and to trace. Where
practical, refactor so the POU has a single exit point.
```

**Fix.** Restructure with a single return point at the end of the
POU, using `IF` / `CASE` to set the return variable.

## ASSIGNMENT_IN_CONDITION

**Severity:** `warn`

`:=` used inside an `IF` / `WHILE` / `REPEAT` condition expression.

**Why it matters.** IEC 61131-3 evaluates `x := y` as the assigned
value, so `IF x := y THEN` works — but the human intent is almost
always `IF x = y THEN`. Easy to typo, hard to spot.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF iCounter := 0 THEN ...          (* fires — probably meant `IF iCounter = 0` *)
```

**The bot posts.**

```
🟧 warn  ASSIGNMENT_IN_CONDITION
Assignment (`:=`) used inside a conditional expression
IEC 61131-3 `IF x := y THEN` performs an assignment then tests the
result. Almost always a typo for `IF x = y THEN`.
```

**Fix.** Change `:=` to `=`, or pull the assignment out above the
conditional if it was deliberate.

## COMMENTED_OUT_CODE

**Severity:** `info`

A comment whose body contains code-shaped tokens (`:=`, `=>`, or
keywords like `IF`, `FOR`, `RETURN`).

**Why it matters.** Commented-out code rots within weeks. Git
remembers the previous version; the inline comment just confuses
readers. Either delete it or mark the intent clearly.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* iCounter := iCounter + 1; *)    (* fires *)
```

**The bot posts.**

```
🟦 info  COMMENTED_OUT_CODE
Comment contains code-shaped content
Commented-out code rots fast. Either remove the block (git
remembers it) or wrap it in a clearly-labeled `(* TODO: ... *)`
if you really want to keep the snippet for later.
```

**Fix.** Delete the comment, or convert to an explicit
`(* TODO: ... *)` with a date and rationale.

## RECURSIVE_CALL

**Severity:** `warn`

A POU invokes itself directly.

**Why it matters.** IEC 61131-3 implementations have a bounded
stack; recursion risks overflow on any input that nests beyond a
shallow depth. Convert to iteration where the algorithm allows.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Recur
VAR fbThis : FB_Recur; END_VAR
fbThis();                          (* fires *)
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟧 warn  RECURSIVE_CALL
Recursive call: FB_Recur calls itself
IEC 61131-3 implementations have a bounded stack; recursion risks
overflow on any input that nests deeper than a few levels.
```

**Fix.** Convert to iteration with an explicit stack / queue, or
prove the recursion depth is bounded and document the bound.

## FORBIDDEN_SYMBOL

**Severity:** `error` (config-driven — off by default)

An identifier matches an entry in the repo's `forbidden_symbols`
blocklist.

**Why it matters.** Every team has a list of deprecated globals,
unsafe vendor APIs, or banned legacy functions. Codifying the list
in config beats a wiki page that nobody reads.

**Settings.**

```yaml
forbidden_symbols:
  - DangerousLegacyApi           # exact match
  - /^Deprecated_/               # regex inside slashes
  - /\bUnsafeRead\b/             # word-boundary regex
```

Off by default. Add at least one pattern to enable.

**Trigger.**

```pascal
DangerousLegacyApi();              (* fires when DangerousLegacyApi is blocked *)
```

**The bot posts.**

```
🟥 error  FORBIDDEN_SYMBOL
Forbidden identifier 'DangerousLegacyApi' is referenced
This identifier is on the repo-configured `forbidden_symbols`
blocklist. Replace it with the approved alternative.
```

**Fix.** Replace with the approved alternative, or remove the
pattern from `forbidden_symbols` if you want to allow it again.

## ADDRESS_OF_CONSTANT

**Severity:** `warn`

`ADR(c)` where `c` is a `VAR_GLOBAL CONSTANT`.

**Why it matters.** A CONSTANT may live in flash / read-only storage
on some runtimes; dereferencing a pointer derived from it can fault.
Even when it works today, the pointer's value isn't actually mutable.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_GLOBAL CONSTANT
    cMax : INT := 100;
END_VAR

pMax := ADR(cMax);                 (* fires *)
```

**The bot posts.**

```
🟧 warn  ADDRESS_OF_CONSTANT
ADR(cMax) — taking the address of a CONSTANT
A CONSTANT may live in flash/read-only storage on some runtimes;
dereferencing a pointer derived from it can fault.
```

**Fix.** If you need a mutable copy, declare a regular `VAR_GLOBAL`
initialised to the constant value.

## UNUSED_OUTPUT_VAR

**Severity:** `info`

A `VAR_OUTPUT` is declared but never written inside the POU.

**Why it matters.** Callers reading the output only ever see its
initial value. Often a half-finished refactor or a TODO that never
landed.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Pump
VAR_OUTPUT
    xDone : BOOL;                  (* fires if nothing in the body assigns xDone *)
END_VAR
```

**The bot posts.**

```
🟦 info  UNUSED_OUTPUT_VAR
VAR_OUTPUT xDone in FB_Pump is declared but never written
Callers reading this output will only ever see its initial value.
```

**Fix.** Wire the output to actual logic, or remove the declaration.

## OUTPUT_VAR_READ_INTERNALLY

**Severity:** `info`

A `VAR_OUTPUT` is read inside the same POU.

**Why it matters.** Outputs are for publishing state to callers, not
internal working storage. Reading one back inside the POU usually
means you wanted a local intermediate variable.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_OUTPUT
    rResult : REAL;
END_VAR

rResult := rResult + rInput;       (* fires — rResult on the RHS *)
```

**The bot posts.**

```
🟦 info  OUTPUT_VAR_READ_INTERNALLY
VAR_OUTPUT rResult is read inside FB_Pump
An output is meant to publish a result, not to store working state.
Reading it back inside the same POU usually means you wanted a
local intermediate.
```

**Fix.** Introduce a local for the working value and assign the
output once at the end of the POU.

## NESTED_COMMENTS

**Severity:** `info`

A block comment contains another block comment.

**Why it matters.** Different IEC 61131-3 implementations handle
`(* outer (* inner *) *)` differently — some treat the first `*)`
as the terminator, leaving the rest as code. Even where the
implementation is well-defined, the syntax is confusing to readers.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* outer (* nested *) text *)      (* fires *)
```

**The bot posts.**

```
🟦 info  NESTED_COMMENTS
Nested block comment
IEC 61131-3 implementations differ on whether `(* outer (* inner *) *)`
is valid. Replace nested blocks with single-line `//` comments or
join them.
```

**Fix.** Replace with `//` line comments inside the block, or join
the blocks into one.

## NAMING_CONVENTION

**Severity:** `warn` (config-driven — off by default)

A declaration name doesn't match the configured prefix, suffix, or
regex for its kind.

**Why it matters.** Naming conventions are how teams keep large
codebases skimmable. The engine doesn't ship any blessed convention —
your team writes the rules in `naming_conventions:`, optionally
composed from shared preset files via `extends:` (see
[`preset-packs.md`](preset-packs.md)).

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

---

# Using a check in your PR

`plc-st-review` runs automatically once you've set up the GitLab or
GitHub integration (see [`gitlab-setup.md`](gitlab-setup.md) /
[`github-setup.md`](github-setup.md)). Every check above lands as
either an inline comment on the relevant `.st` line or as part of the
summary issue / discussion comment when the affected line falls
outside the PR's diff hunks.

To suppress a check for a single repo, add it to `disabled_checks` in
`.plc-st-review.yml`. To raise or lower its severity, use
`severity_overrides`. See [`tuning-severities.md`](tuning-severities.md)
for the tuning ramp.

To compose policy across many repos — naming conventions, severity
profiles, forbidden symbols — use `extends:` to pull from shared
preset files. See [`preset-packs.md`](preset-packs.md).
