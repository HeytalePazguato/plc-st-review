# NESTED_COMMENTS

**Severity:** `info`

A block comment contains another block comment.

**Why it matters.** Different IEC 61131-3 implementations handle
`(* outer (* inner *) *)` differently — some treat the first `*)`
as the terminator, leaving the rest as code. Even where the
implementation is well-defined, the syntax is confusing to readers.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* outer (* nested *) text *)      (* fires *)
```

**The bot posts.**

```
🟦 info  NESTED_COMMENTS
Nested block comment
IEC 61131-3 implementations differ on whether `(* outer (* inner *) *)`
is valid. Replace nested blocks with single-line `//` comments or
join them.
```

**Fix.** Replace with `//` line comments inside the block, or join
the blocks into one.
