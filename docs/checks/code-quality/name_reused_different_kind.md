# NAME_REUSED_DIFFERENT_KIND

**Severity:** `warn`.
**PLCopen:** N9 — different element kinds shall not share a name.

The same identifier is used across declaration kinds (e.g. a global variable AND an enum type). PLCopen forbids this because it confuses readers and navigation tools, and silently changes meaning when scope visibility shifts.

**Settings.** No check-specific config; the comparison is case-folded by default and switches to exact-case when `case_sensitive: true`.

**Trigger.**

```pascal
VAR_GLOBAL
    status : INT;
END_VAR
TYPE status : (IDLE, ACTIVE); END_TYPE   (* fires *)
```

**The bot posts.**

```
🟧 warn  NAME_REUSED_DIFFERENT_KIND
Name 'status' is reused across kinds (enum_type, var_global) — PLCopen N9
```

**Fix.** Rename one of them. By convention, type names take a prefix or suffix (e.g. `Status_E`, `E_Status`) that prevents the collision in the first place.
