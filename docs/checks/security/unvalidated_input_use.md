# UNVALIDATED_INPUT_USE

**Severity:** `info`

A `VAR_INPUT` reaches a sensitive operation in the same POU — an array subscript or a divisor — and the POU's body contains no relational comparison (`< > <= >= = <>`) involving that input. The check sees no in-POU guard.

**Why it matters.** IEC 62443-4-2 CR 3.5 (input validation): inputs used as process-control inputs or that directly impact the component's action shall be validated. A caller passing a wild value (out-of-range index, zero divisor) lands directly in undefined territory — at best the runtime traps, at worst the unchecked value drives the process to a hazardous state.

**Settings.** No check-specific config in v0.x. Default severity is `info` because the heuristic produces noise on POUs where validation happens in the caller (see Limits).

**Limits.** This is an approximation, not a flow-sensitive proof.

- **Caller-side validation isn't visible.** A caller that bounds the input before invoking the POU still triggers a finding here — the engine only sees the called POU's body. The 62443 posture is "validate locally even if a caller already did" because it makes the validation evident in the POU's source.
- **Comparison location isn't ordered.** A guard that lexically follows the dangerous use in the source is treated the same as one that precedes it; the engine does not model control flow. The trade-off favours fewer false positives.
- **Only direct uses.** `arr[idx]` and `x / denom` are flagged; `arr[idx + 1]` or `x / (denom + 1)` are out of scope (the expression no longer has the input as the leading identifier).

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Lookup
VAR_INPUT idx : INT; END_VAR
VAR arr : ARRAY [0..9] OF INT; END_VAR
arr[idx] := 1;                          (* fires *)
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_Lookup_Safe
VAR_INPUT idx : INT; END_VAR
VAR arr : ARRAY [0..9] OF INT; END_VAR
IF idx >= 0 AND idx <= 9 THEN
    arr[idx] := 1;                      (* OK — guarded *)
END_IF;
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟦 info  UNVALIDATED_INPUT_USE
VAR_INPUT 'idx' used as array subscript without an in-POU guard (IEC 62443-4-2 CR 3.5)
```

**Fix.** Add a bounds check before the sensitive use:

```pascal
IF inputName >= LOWER_BOUND AND inputName <= UPPER_BOUND THEN
    (* use *)
END_IF;
```

If your codebase relies on caller-side validation by convention, document that contract in the POU's header comment and accept the `info` finding (or disable the check repo-wide via `disabled_checks`).
