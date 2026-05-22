# NESTING_INCREASED

**Severity:** `warn` (default) / `error` (new depth crosses the error threshold)

A POU's maximum control-structure nesting depth increased and now sits beyond the configured warn threshold. Depth counts nested `IF` / `CASE` / `FOR` / `WHILE` / `REPEAT`; the clauses of a construct (`ELSIF`, `ELSE`, each `CASE` arm) do not add depth on their own.

**Why it matters.** Deeply nested logic is where edge cases hide. A jump in nesting depth is an early signal that a POU is drifting toward arrow-shaped code that is hard to follow and easy to get wrong.

**Settings.** Reads `metrics.thresholds.nesting_depth` from `.plc-st-review.yml`:

```yaml
metrics:
  thresholds:
    nesting_depth:
      warn: 5
      error: 8
```

Fires only when the new depth exceeds the `warn` band. Escalates to `error` when the new depth reaches the `error` band and the old value was below it.

**Trigger.**

```pascal
(* before: max nesting 5 *)
(* after: a new inner FOR inside the deepest IF takes it to 6 *)
```

**The bot posts.**

```
🟧 warn  NESTING_INCREASED
FB_RecipeHandler max nesting depth: 5 → 6 (warn threshold 5)
```

**Fix.** Flatten with guard clauses (early `RETURN`/`CONTINUE`), invert conditions, or hoist an inner block into its own method.
