# DEAD_POU_INTRODUCED

**Severity:** `info`

A `FUNCTION` or `FUNCTION_BLOCK` added in this PR that nothing in the whole project calls.

**Why it matters.** A new block that no call site reaches is either work-in-progress (to be wired up later) or a leftover that shipped by accident. Surfacing it on the PR lets the author confirm which. Info-level by design, an unwired block is often intentional.

**Project-scoped.** This is the only check that needs more than the PR's diff: to know whether a *new* POU has any caller, it has to see call sites in files the PR didn't touch. It therefore runs **only when the review is invoked with `--project-scope`** (a whole-repo parse). Without it, the check is skipped, the engine prints a one-line note to stderr rather than risk a false "nobody calls this". See [project scope](../../project-scope.md) for how to enable it on demand (a PR label is the recommended trigger).

`PROGRAM` POUs are never flagged, they are entry points with no caller by definition.

**Settings.** No check-specific config. Disable like any check via `disabled_checks: [DEAD_POU_INTRODUCED]`.

**Trigger.**

```pascal
(* New file FB_Unused.st added in the PR; no call site anywhere
   instantiates and invokes it. *)
FUNCTION_BLOCK FB_Unused
VAR x : INT; END_VAR
x := 1;
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟦 info  DEAD_POU_INTRODUCED
FB_Unused was added but nothing in the project calls it
```

**Fix.** Wire the new POU into a caller, or remove it if it was committed by mistake. If it is deliberately unconnected for now, leave it, the finding is informational.
