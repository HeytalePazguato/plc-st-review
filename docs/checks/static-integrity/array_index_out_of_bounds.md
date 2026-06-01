# ARRAY_INDEX_OUT_OF_BOUNDS

**Severity:** `error`

A literal index sits outside the array's declared bounds. Dynamic indices (variables, expressions) aren't checked, would need flow analysis.

**Why it matters.** Compile-time bounds checking catches the obvious case; runtime crashes do the rest. Catching the literal-index variant at PR-review time eliminates the cheap mistakes.

**Settings.** No check-specific config.

**Literal forms understood.** Indices and bounds in any standard ST numeric literal are decoded to their real value before comparison: signed decimals (`-7`), reals (`3.14`), based literals (`16#FF`, `2#1010`, `8#17`), digit-group separators (`1_000`, `16#FF_FF`), and typed prefixes (`INT#42`, `UINT#16#FF`). So `arr[2#10000]` (=16) is correctly flagged against `ARRAY[0..15]`, where an old reading would have mis-decoded `2#10000` as `2` and missed it.

**Multi-dimensional arrays — single-dimension limit.** For an `ARRAY [0..9, 0..5] OF INT`, only the **first** subscript of `arr[i, j]` is compared against the **first** declared dimension. An out-of-bounds value on the second dimension (`arr[3, 99]`) is not flagged. The same limit applies to `ARRAY_BOUNDS_CHANGED` and `ARRAY_SINGLE_ELEMENT`. Multi-dim arrays are uncommon in industrial ST (vendors usually flatten to 1-D), so this is a deliberate scope limit rather than a planned extension. If you have a real codebase where multi-dim OOB detection matters, [open an issue](https://github.com/HeytalePazguato/plc-st-review/issues) with a concrete example and I'll prioritize it.

**Trigger.**

```pascal
arr : ARRAY [0..9] OF INT;
arr[15] := 1;                      (* fires *)
arr[2#10000] := 1;                 (* fires — 2#10000 is 16, out of [0..9] *)
```

**The bot posts.**

```
🟥 error  ARRAY_INDEX_OUT_OF_BOUNDS
arr[15] is out of declared bounds [0..9]
Only literal indices are checked; dynamic indices (variables)
require flow analysis and are skipped.
```

**Fix.** Correct the index, or grow the array.
