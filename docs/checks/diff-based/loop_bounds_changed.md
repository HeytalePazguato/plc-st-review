# LOOP_BOUNDS_CHANGED

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
