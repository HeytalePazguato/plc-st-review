# UNINITIALIZED_VAR_USED

**Severity:** `warn`.
**PLCopen:** CP3 — every variable shall be initialised before being used.

A local variable (`VAR`, `VAR_OUTPUT`, `VAR_TEMP`) is read at a source line that comes before its first assignment, and the declaration has no explicit initial value. The value the read sees depends on the runtime's "uninitialised" semantics — often zero, sometimes garbage from a previous scan — and the resulting behaviour is at best undefined.

**Settings.** No check-specific config. This is a source-position heuristic and does **not** model control flow — a conditional initialiser (`IF cond THEN x := 1; END_IF; y := x;`) may produce false positives. The audit roadmap notes that closing that gap needs a full reaching-defs pass.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_U
VAR
    x : INT;
    y : INT;
END_VAR
y := x + 1;     (* fires — x is read before any assignment *)
x := 1;
END_FUNCTION_BLOCK
```

**Not a trigger.** Initial value at the declaration silences the check:

```pascal
VAR
    x : INT := 0;
END_VAR
y := x + 1;     (* quiet *)
```

**The bot posts.**

```
🟧 warn  UNINITIALIZED_VAR_USED
'x' is read before any assignment (PLCopen CP3)
```

**Fix.** Add an initial value to the declaration (`x : INT := 0;`), or move the assignment above the first read.
