---
layout: default
title: Checks reference
---

# Checks reference

Every check `plc-st-review` ships with, in order, with a triggering example
and a suggested fix. See also [check-limitations.md](check-limitations.md)
for what each check deliberately doesn't catch.

Live demo: [PR #1](https://github.com/HeytalePazguato/plc-st-review/pull/1)
is kept open as the canonical demo — every check in this document fires
at least once on that PR.

## Diff-based checks

These compare the "before" and "after" trees of a PR.

### SIGNATURE_CHANGED — `warn` (`error` on breaking changes)

A POU's inputs, outputs, or in-outs were renamed, removed, or had their type
changed. Severity is `error` when the change is breaking (a removed or
type-changed parameter, or a new required input without a default).

```pascal
(* before *)                       (* after *)
FUNCTION_BLOCK FB_Pump             FUNCTION_BLOCK FB_Pump
VAR_INPUT                          VAR_INPUT
    xEnable : BOOL;                    xEnable : BOOL;
END_VAR                                xManualOverride : BOOL;  (* new required input *)
                                   END_VAR
```

**Fix:** add a default to the new input (`xManualOverride : BOOL := FALSE;`),
or update every call site.

### CALL_SITE_OUTDATED — `error`

A caller doesn't pass a required argument that the callee now requires, or
passes an argument name the callee doesn't have. Resolves FB-instance calls
(e.g. `fbConveyor(...)`) through their type back to the POU.

```pascal
fbConveyor(xEnable := TRUE, rTargetSpeed := 50.0);
(* fires: FB_ConveyorState gained required xManualOverride *)
```

**Fix:** add the missing argument or correct the typo.

### TYPE_MISMATCH — `error`

A `VAR_GLOBAL` declaration's type changed between revisions. Cross-file:
lists any files that reference the global in the new revision.

```pascal
(* before *)                       (* after *)
VAR_GLOBAL                         VAR_GLOBAL
    gFlow : REAL := 0.0;               gFlow : INT := 0;
END_VAR                            END_VAR
```

**Fix:** revert the type, or update every reader / writer to match.

### ENUM_VALUE_REMOVED — `error`

A `CASE` statement references a value that was removed from the enum.

```pascal
(* before: enum had IDLE, RUNNING, FAULT — FAULT was removed in after *)
CASE eState OF
    E_State.IDLE: ...
    E_State.FAULT: ...   (* this branch now references a deleted value *)
END_CASE;
```

**Fix:** restore the enum value, or update the `CASE` to drop the reference.

### ENUM_VALUE_ADDED — `warn`

An enum gained a value and a `CASE` on that enum has no matching branch and
no `ELSE`. See also `STATE_UNHANDLED` for the same condition without
requiring an enum-diff.

```pascal
(* enum added ERROR_RECOVERY but this CASE doesn't handle it: *)
CASE eState OF
    E_State.IDLE: ...
    E_State.RUNNING: ...
    (* no ERROR_RECOVERY branch, no ELSE *)
END_CASE;
```

**Fix:** add the missing branch, or add an `ELSE` that handles unknown
states.

### TIMER_VALUE_CHANGED — `info` / `warn` / `error` by ratio

`TON` / `TOF` / `TP` `PT` changed. `info` if the ratio is below 2×; `warn`
if ≥ 2×; `error` if ≥ 10×.

```pascal
(* before *)                       (* after *)
T_StartupDelay(PT := T#5s);        T_StartupDelay(PT := T#500ms);
(* fires: 10× faster — error *)
```

**Fix:** confirm the change is intentional (e.g. a documented tuning), or
revert.

### CONSTANT_VALUE_CHANGED — `info` (`warn` on safety-prefixed names)

A `VAR_GLOBAL CONSTANT` initial value changed. Names starting with prefixes
in `safety_critical_prefixes` (default: `SAFETY_`, `INTERLOCK_`, `SIL_`,
`LIMIT_`, `MAX_`, `MIN_`) elevate to `warn`.

```pascal
(* before *)                       (* after *)
VAR_GLOBAL CONSTANT                VAR_GLOBAL CONSTANT
    SAFETY_TIMEOUT : TIME := T#2s;     SAFETY_TIMEOUT : TIME := T#10s;
END_VAR                            END_VAR
(* fires: warn — SAFETY_ prefix *)
```

**Fix:** if the change is documented and reviewed, suppress with
`disabled_checks: [CONSTANT_VALUE_CHANGED]` or tune
`safety_critical_prefixes`.

### COMMENT_ONLY — `info`

The file's AST is structurally identical between revisions; only comments
or whitespace changed.

**Fix:** none needed — this is informational so reviewers can skim past
"safe" changes faster.

### ARRAY_BOUNDS_CHANGED — `error` (shrink) / `warn` (grow)

`ARRAY [a..b]` bounds changed.

```pascal
arr : ARRAY [0..9] OF INT;     (* before *)
arr : ARRAY [0..4] OF INT;     (* after — shrunk, error *)
```

**Fix:** if intentional, ensure every accessor uses indices within the new
range.

### STATE_UNHANDLED — `info`

A `CASE` on an enum has no `ELSE` and doesn't cover every enum value —
regardless of whether the enum changed in this PR. Catches gaps that
`ENUM_VALUE_ADDED` misses (e.g. a CASE that's been incomplete from day one).

**Fix:** add the missing branches or an `ELSE`.

### UNREACHABLE_CODE — `warn`

A statement was newly placed after `RETURN` / `EXIT` / `CONTINUE` in the
same block.

```pascal
RETURN;
iCount := 99;   (* unreachable — fires *)
```

**Fix:** remove the statement, or move the terminator after it.

### LOOP_BOUNDS_CHANGED — `info` / `warn`

A `FOR` loop's start / end / step changed. `warn` when the iteration
ratio crosses 10×.

```pascal
(* before *)                              (* after *)
FOR i := 1 TO 10 BY 1 DO ...              FOR i := 1 TO 100 BY 1 DO ...
(* fires: 10 -> 100 iterations, warn *)
```

**Fix:** confirm the change is intentional. Often this is the actual
intent and you'd suppress, but loops with growth this dramatic are worth
a sanity-check on cycle time.

### POU_DELETED — `error` (with callers) / `warn` (no callers)

A POU disappeared. `error` when call sites in the new revision still
reference it; `warn` when no caller remains.

**Fix:** restore the POU, or update / delete the surviving call sites.

### POU_RENAMED — `info`

Heuristic: a deleted POU plus an added POU with an identical signature in
the same PR. Suggests a rename.

**Fix:** if it really was a rename, update every call site to the new
name. If the two POUs are different despite the signature coincidence,
ignore.

### METHOD_ADDED_TO_INTERFACE — `error`

An `INTERFACE` gained a method, but a `FUNCTION_BLOCK` that `IMPLEMENTS`
it doesn't declare one.

**Fix:** add the missing method to the implementer.

### INHERITANCE_CHANGED — `warn`

`EXTENDS` clause was added, removed, or changed.

**Fix:** verify the new base provides the expected methods / state and
that any overrides still align.

### PRAGMA_CHANGED — `info`

The set of pragmas in a file is different from the previous revision.

**Fix:** make sure the new pragma set is what your codegen / IDE expects.

### UNUSED_VAR_INTRODUCED — `info`

A new local variable was declared in this PR but isn't referenced
anywhere in its scope.

**Fix:** remove the declaration or add a use.

### COUNTER_VALUE_CHANGED — `info` / `warn` / `error` by ratio

`CTU` / `CTD` / `CTUD` `PV` changed. Severity follows the same ratio
rules as `TIMER_VALUE_CHANGED`.

```pascal
(* before *)                       (* after *)
C1(CU := xPulse, PV := 10);        C1(CU := xPulse, PV := 100);
(* fires: 10× — error *)
```

**Fix:** confirm the change is intentional.

## Static checks

These look at the new revision in isolation. By default they only flag
bugs that **weren't already present** in the base revision — adopting on
a legacy repo doesn't dump a wall of pre-existing findings on day one.

### ENUM_VALUE_UNUSED — `info`

An enum value is declared but never referenced in any `CASE` or member
access anywhere in the repo.

```pascal
TYPE E_State : (IDLE, RUNNING, ARCHIVED, FAULT); END_TYPE
(* if no code anywhere references E_State.ARCHIVED, fires *)
```

**Fix:** remove the value, or add a `CASE` branch / handler that
references it.

### ENUM_MEMBER_UNKNOWN — `error`

A qualified ref like `E_State.IDEL` doesn't match any declared member —
likely a typo. Detail lists the actual member names as candidates.

```pascal
eState := E_State.IDEL;   (* typo — should be IDLE; fires *)
```

**Fix:** correct the typo.

### ARRAY_INDEX_OUT_OF_BOUNDS — `error`

A literal index sits outside the array's declared bounds. Dynamic
indices (variables) aren't checked — would need flow analysis.

```pascal
arr : ARRAY [0..9] OF INT;
arr[15] := 1;   (* fires — 15 is outside [0..9] *)
```

**Fix:** correct the index or grow the array.

### DIVISION_BY_ZERO — `error`

The divisor is a literal `0` or a `VAR_GLOBAL CONSTANT` resolving to 0.

```pascal
rResult := rInput / 0;        (* fires *)
rResult := rInput / cZero;    (* fires if cZero resolves to 0 *)
```

**Fix:** use a non-zero divisor, or guard with `IF cZero <> 0 THEN`.

### INFINITE_LOOP — `error`

`WHILE TRUE` (or `WHILE 1`) with no `EXIT` statement inside the body. On
a PLC scan, this blocks the rest of the program forever.

```pascal
WHILE TRUE DO
    iCounter := iCounter + 1;  (* fires — no EXIT *)
END_WHILE;
```

**Fix:** add an `EXIT` condition or convert to a state machine.

### LOOP_BOUNDS_REVERSED — `error`

A `FOR` loop's bounds and step point opposite directions: positive step
with start > end, or negative step with start < end. Per IEC 61131-3 the
body never runs; on runtimes that wrap integer overflow it runs hundreds
of times.

```pascal
FOR i := 10 TO 5 BY 1 DO ...      (* fires *)
FOR i := 1 TO 10 BY -1 DO ...     (* fires *)
```

**Fix:** swap start / end, or invert the BY direction.

### COUNTER_PV_ZERO — `error`

`CTU` / `CTD` / `CTUD` initialized with `PV := 0`. Q trips immediately
(CTU) or never (CTD), neither of which is usually intended.

```pascal
C1(CU := xPulse, PV := 0);   (* fires *)
```

**Fix:** set a positive preset.

### TIMER_PT_ZERO — `error`

`TON` / `TOF` / `TP` set with `PT := T#0s` (or a constant that resolves
to zero). PT of zero either fires immediately or never, depending on
type — almost always a bug.

```pascal
T1(IN := xEnable, PT := T#0s);   (* fires *)
```

**Fix:** set a non-zero PT.

### TIMER_NOT_DRIVEN — `warn`

A timer's `.Q` / `.ET` output is read elsewhere in the POU, but no call
site for that instance has an `IN` named argument — the timer is never
actually driven.

```pascal
T1(PT := T#5s);    (* IN missing *)
IF T1.Q THEN ...   (* will always read FALSE *)
```

**Fix:** add `IN := <condition>` to the timer call.

### EDGE_TRIG_REUSED — `error`

The same `R_TRIG` / `F_TRIG` instance is invoked with **different** `CLK`
expressions across the POU. An edge-trigger holds internal state;
swapping its input scrambles the detection.

```pascal
rTrig(CLK := xButton);
rTrig(CLK := xSensor);   (* fires — same instance, different CLK *)
```

**Fix:** declare one `R_TRIG` instance per input signal.

### FB_INSTANCE_DOUBLE_CALL — `warn`

The same FB instance is invoked more than once in one scope's scan. FB
instances hold state — the second call overwrites outputs from the
first.

```pascal
T1(IN := xA, PT := T#1s);
T1(IN := xB, PT := T#1s);   (* fires *)
```

**Fix:** use one instance per call site, or consolidate the logic.

### FB_INSTANCE_NEVER_CALLED — `warn`

An FB instance is declared, its outputs are read somewhere in the POU,
but no call site invokes it. Outputs never update.

```pascal
VAR
    T1 : TON;
END_VAR
(* no T1(...) call anywhere *)
IF T1.Q THEN ...   (* fires — T1.Q is read but T1 is never invoked *)
```

**Fix:** add a call site for the instance, or remove the declaration if
it's not needed.

### BISTABLE_DOMINANCE_MISMATCH — `info` (heuristic)

Variable naming hints at the wrong dominance. `SR` is set-dominant, `RS`
is reset-dominant. Names containing `eStop`, `reset`, `trip`, `fault`,
`safety`, `lock` suggest reset-dominant (`RS`); names containing `set`,
`latch`, `enable`, `start`, `arm` suggest set-dominant (`SR`).

This is a naming-convention heuristic — false positives are expected.
Disable via `disabled_checks: [BISTABLE_DOMINANCE_MISMATCH]` if your shop
names otherwise.

```pascal
eStopLatch : SR;   (* fires — name suggests reset-dominant, type is set-dominant *)
```

**Fix:** change the type to match the intent, or rename the variable.

## Using a check in your PR

`plc-st-review` runs automatically once you've set up the GitLab or
GitHub integration (see [gitlab-setup.md](gitlab-setup.md) /
[github-setup.md](github-setup.md)). Every check above lands as either
an inline comment on the relevant `.st` line or as part of the summary
issue / discussion comment when the affected line falls outside the
PR's diff hunks.

To suppress a check for a single repo, add it to `disabled_checks` in
`.plc-st-review.yml`. To raise or lower its severity, use
`severity_overrides`. See [tuning-severities.md](tuning-severities.md).
