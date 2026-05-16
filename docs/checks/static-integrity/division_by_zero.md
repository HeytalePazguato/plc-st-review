# DIVISION_BY_ZERO

**Severity:** `error`

The divisor is a literal `0` or a `VAR_GLOBAL CONSTANT` resolving to zero.

**Why it matters.** Division by zero traps at runtime on most PLC runtimes, halting the program. The cheap literal cases are the easiest to catch and the most embarrassing to ship.

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

**Fix.** Use a non-zero divisor, or guard with `IF cZero <> 0 THEN ... END_IF;`.
