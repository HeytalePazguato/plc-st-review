# METHOD_ADDED_TO_INTERFACE

**Severity:** `error`

An `INTERFACE` gained a method but a `FUNCTION_BLOCK` that
`IMPLEMENTS` it doesn't declare one.

**Why it matters.** The compiler eventually catches this, but only
when the interface is actually used. The check surfaces it at PR
review so the implementer can be updated in the same PR.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before: INTERFACE IDrivable METHOD Start END_METHOD END_INTERFACE *)
(* after: gained METHOD Stop *)

FUNCTION_BLOCK FB_Pump IMPLEMENTS IDrivable
    METHOD Start ... END_METHOD
    (* no Stop method — fires *)
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟥 error  METHOD_ADDED_TO_INTERFACE
FB_Pump does not implement new method(s) on IDrivable: Stop
Implementing FBs must declare matching methods.
```

**Fix.** Add the missing method to every implementer, or revert
the interface change.
