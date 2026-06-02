# TIME_EQUALITY

**Severity:** `warn`.
**PLCopen:** CP28 — equality/inequality comparison on TIME values shall not be used.

A `=` or `<>` comparison involves a TIME-typed value (variable or literal: `T#5s`, `TIME#PT1S`, `LTIME#…`). Mechanically similar to `REAL_EQUALITY`: tick-resolution granularity means two "equal" durations sampled at slightly different cycles can compare unequal. Use a range comparison or a tolerance instead.

**Settings.** No check-specific config. Affected types: `TIME`, `LTIME`, `TIME_OF_DAY` / `TOD`, `DATE`, `DATE_AND_TIME` / `DT`. Literals starting with `T#`, `TIME#`, or `LTIME#` are also treated as TIME operands.

**Trigger.**

```pascal
VAR
    tElapsed : TIME;
    bDone    : BOOL;
END_VAR
bDone := tElapsed = T#5s;     (* fires *)
```

**The bot posts.**

```
🟧 warn  TIME_EQUALITY
TIME equality compare 'tElapsed = T#5s' (PLCopen CP28)
```

**Fix.** Compare against a range, e.g. `tElapsed >= T#5s`. If you really need "elapsed exactly N", capture the equality via a rising-edge on the inequality flip rather than a literal equality compare.
