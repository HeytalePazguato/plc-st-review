# IDENTIFIER_CASE_MISMATCH

**Severity:** `warn`

A reference uses a different case than the declaration. In the **case-insensitive** dialect (the default — IEC standard, CODESYS, TwinCAT), identifiers are folded so `iCount` and `ICOUNT` are the same symbol, but inconsistent casing hurts readability and breaks tools that aren't case-folding.

**Why it matters.** `iCount` vs `icount` vs `Icount` in the same file is a real maintenance smell. Pick a spelling at declaration time and stick to it.

**Settings.** No check-specific config, but this check is automatically **disabled** when `case_sensitive: true` is set (e.g. for B&R Automation Studio). In a case-sensitive dialect a different case is a genuinely different — or undefined — symbol, not a style slip, so the check doesn't apply. See [Case sensitivity](../../case-sensitivity.md).

**Scope.** Resolution is **per scope**: a `count` referenced inside `FB_A` is matched against `FB_A`'s own `count` declaration (or any visible enclosing scope), not against an unrelated `Count` in some other POU. This prevents the spurious "case mismatch" findings that an older file-wide lookup would produce on two POUs that happen to share a name.

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
