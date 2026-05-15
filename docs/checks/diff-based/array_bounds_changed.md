# ARRAY_BOUNDS_CHANGED

**Severity:** `error` (shrink) / `warn` (grow)

An `ARRAY [a..b] OF T` declaration's bounds changed.

**Why it matters.** Shrinking an array means any indexed access at
the old upper bound is now out of range; growing it changes memory
layout and may invalidate hard-coded loop bounds in callers.

**Settings.** No check-specific config.

**Trigger.**

```pascal
arr : ARRAY [0..9] OF INT;     (* before *)
arr : ARRAY [0..4] OF INT;     (* after, shrunk, error *)
```

**The bot posts.**

```
🟥 error  ARRAY_BOUNDS_CHANGED
Array arr bounds: [0..9] → [0..4]
Array shrank, any indexed access that hit the old upper bound is
now out of range.
```

**Fix.** Ensure every accessor uses indices within the new range, or
keep the old size.
