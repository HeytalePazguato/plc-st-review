# COMMENT_ONLY

**Severity:** `info`

The file's AST is structurally identical between revisions; only
comments or whitespace changed.

**Why it matters.** Lets reviewers skim past files that won't change
behavior. Pair-aware: only triggers when the two ASTs match, a
single-character semantic change defeats it.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before *)                       (* after *)
(* old comment *)                  (* new comment *)
FUNCTION_BLOCK FB_Steady           FUNCTION_BLOCK FB_Steady
END_FUNCTION_BLOCK                 END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟦 info  COMMENT_ONLY
Only comments changed in this file
AST structure is identical between revisions.
```

**Fix.** None needed, informational.
