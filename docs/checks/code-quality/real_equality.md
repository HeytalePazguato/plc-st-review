# REAL_EQUALITY

**Severity:** `warn`

`=` or `<>` against a `REAL` / `LREAL` literal. Floating-point arithmetic almost never produces the exact bit pattern of a literal, so the comparison is unreliable.

**Why it matters.** Classic floating-point trap. The expression *looks* obvious but can return FALSE for values you'd consider equal, and TRUE for values you'd consider different.

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

**Fix.** Compare against a tolerance band, or convert to a fixed-point integer before comparing.
