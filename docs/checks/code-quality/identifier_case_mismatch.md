# IDENTIFIER_CASE_MISMATCH

**Severity:** `warn`

A reference uses a different case than the declaration. IEC ST identifiers are case-insensitive, but inconsistent casing hurts readability and breaks tools that aren't case-folding.

**Why it matters.** `iCount` vs `icount` vs `Icount` in the same file is a real maintenance smell. Pick a spelling at declaration time and stick to it.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR
    iCount : INT;
END_VAR

icount := icount + 1;              (* fires, both refs wrong-cased *)
```

**The bot posts.**

```
🟧 warn  IDENTIFIER_CASE_MISMATCH
'icount' uses a different case than its declaration 'iCount'
```

**Fix.** Match the declared spelling.
