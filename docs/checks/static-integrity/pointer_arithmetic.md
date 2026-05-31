# POINTER_ARITHMETIC

**Severity:** `warn`.
**PLCopen:** E2 — pointer arithmetic shall not be used.

A binary `+`, `-`, `*`, or `/` is applied where at least one operand is a `POINTER TO …` typed local. Arithmetic on POINTER values is non-portable across vendor runtimes (sizes and strides differ), and most "I need to compute an offset" code is better written by indexing into a sized array.

**Settings.** No check-specific config. The check tracks POINTER-typed declarations in the symbol table and matches operands by their leading identifier (so `pAddr + 1` and `pAddr.foo + 1` both fire).

**Trigger.**

```pascal
VAR pAddr : POINTER TO INT; END_VAR
pAddr := pAddr + 1;                    (* fires *)
```

**The bot posts.**

```
🟧 warn  POINTER_ARITHMETIC
Pointer arithmetic on 'pAddr + 1' (PLCopen E2)
```

**Fix.** Use ARRAY indexing or a typed buffer wrapper instead of `pAddr + n`.
