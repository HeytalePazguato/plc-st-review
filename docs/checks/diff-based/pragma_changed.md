# PRAGMA_CHANGED

**Severity:** `info`

The set of pragmas in a file is different from the previous revision.

**Why it matters.** Pragmas (`{attribute '...'}`) often control
codegen, retention, persistence, build-task assignment — invisible
to the language but loud in the binary. Worth a glance.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before *)                  (* after *)
{attribute 'no_check'}        {attribute 'noinit'}
FUNCTION_BLOCK FB             FUNCTION_BLOCK FB
END_FUNCTION_BLOCK            END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟦 info  PRAGMA_CHANGED
Pragma(s) changed in FB.st (1 added, 1 removed)
  + {attribute 'noinit'}
  - {attribute 'no_check'}
```

**Fix.** Confirm the new pragma set matches the intent. Suppress
per-repo if your team uses pragmas heavily and the noise dominates.
