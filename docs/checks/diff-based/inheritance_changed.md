# INHERITANCE_CHANGED

**Severity:** `warn`

An `EXTENDS` clause was added, removed, or changed.

**Why it matters.** A new base brings new methods, possibly with
different bodies than expected; removing one orphans `super`
references. The check makes the change loud.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Derived EXTENDS FB_OldBase     (* before *)
FUNCTION_BLOCK FB_Derived EXTENDS FB_NewBase     (* after, fires *)
```

**The bot posts.**

```
🟧 warn  INHERITANCE_CHANGED
FB_Derived EXTENDS clause changed: FB_OldBase → FB_NewBase
Derived behavior may have changed. Verify that the new base provides
the expected methods and that overrides still align.
```

**Fix.** Walk every overridden method to make sure it still applies
to the new base. Smoke-test on a representative input.
