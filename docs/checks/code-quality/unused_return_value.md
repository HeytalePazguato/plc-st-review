# UNUSED_RETURN_VALUE

**Severity:** `info`

A function (POU with a return type) is invoked as a bare statement, discarding the result.

**Why it matters.** Either the call was for side effects (which functions in IEC ST shouldn't really have) or the return value should be used. Both warrant a closer look.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION Compute : INT
    Compute := 42;
END_FUNCTION

Compute();                         (* fires, return value discarded *)
```

**The bot posts.**

```
🟦 info  UNUSED_RETURN_VALUE
Return value of Compute() (declared INT) is discarded
Calling a function as a bare statement throws away its result.
Assign it to a variable or use the value in an expression.
```

**Fix.** Assign the result (`iResult := Compute();`), or use it in an expression.
