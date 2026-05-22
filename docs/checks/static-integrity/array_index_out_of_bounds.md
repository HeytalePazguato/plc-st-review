# ARRAY_INDEX_OUT_OF_BOUNDS

**Severity:** `error`

A literal index sits outside the array's declared bounds. Dynamic indices (variables, expressions) aren't checked, would need flow analysis.

**Why it matters.** Compile-time bounds checking catches the obvious case; runtime crashes do the rest. Catching the literal-index variant at PR-review time eliminates the cheap mistakes.

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
