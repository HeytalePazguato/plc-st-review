# POINTER_COMPARED

**Severity:** `warn`.
**PLCopen:** E3 — some comparator instructions shall not be used for pointers.

A relational comparison `<`, `>`, `<=`, or `>=` is applied to a POINTER-typed operand. PLCopen forbids relational pointer comparisons because the runtime's address ordering is not standardised — the same code can return different results on different vendor runtimes. Equality (`=` / `<>`) comparisons of pointers are still allowed.

**Settings.** No check-specific config. Operands are tracked as POINTER-typed via the symbol table.

**Trigger.**

```pascal
VAR pA, pB : POINTER TO INT; END_VAR
IF pA < pB THEN ...                    (* fires *)
```

**The bot posts.**

```
🟧 warn  POINTER_COMPARED
Relational comparison of pointer 'pA < pB' (PLCopen E3)
```

**Fix.** Use `=` / `<>` if you need to check pointer identity, or compare the values they point at (`pA^` vs `pB^`).
