# LOC_SPIKE

**Severity:** `info`

A single POU's lines of code grew by more than 50% in one PR. Line count comes from the AST: blank lines and comment-only lines are excluded, a line with code plus a trailing comment still counts.

**Why it matters.** A large dump of code into one POU in a single change is worth a second look, it often means several concerns landed together and could be split, or that generated code slipped into review. Informational only: a spike is a prompt to look, not a defect.

**Settings.** No check-specific config. The 50% growth bar is fixed.

**Trigger.**

```pascal
(* before: 120 lines of code *)
(* after: 190 lines of code, +58% *)
```

**The bot posts.**

```
🟦 info  LOC_SPIKE
FB_DiagnosticsHandler lines of code: 120 → 190 (+58%)
```

**Fix.** Confirm the addition is one coherent change. If it bundles several concerns, split it across POUs or PRs. If the growth is expected (e.g. a generated table), no action is needed.
