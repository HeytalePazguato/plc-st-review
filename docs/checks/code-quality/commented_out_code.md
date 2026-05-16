# COMMENTED_OUT_CODE

**Severity:** `info`

A comment whose body contains code-shaped tokens (`:=`, `=>`, or keywords like `IF`, `FOR`, `RETURN`).

**Why it matters.** Commented-out code rots within weeks. Git remembers the previous version; the inline comment just confuses readers. Either delete it or mark the intent clearly.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* iCounter := iCounter + 1; *)    (* fires *)
```

**The bot posts.**

```
🟦 info  COMMENTED_OUT_CODE
Comment contains code-shaped content
Commented-out code rots fast. Either remove the block (git
remembers it) or wrap it in a clearly-labeled `(* TODO: ... *)`
if you really want to keep the snippet for later.
```

**Fix.** Delete the comment, or convert to an explicit `(* TODO: ... *)` with a date and rationale.
