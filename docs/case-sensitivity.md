# Case sensitivity

Whether two identifiers that differ only in case (`Motor` vs `motor`) are the **same** symbol is **dialect-dependent**. `plc-st-review` makes it configurable with one top-level key in `.plc-st-review.yml`:

```yaml
case_sensitive: false   # default
```

## Which value matches your toolchain?

| Toolchain | Setting | Why |
|---|---|---|
| Generic IEC 61131-3 (per the standard) | `false` (default) | The standard specifies identifiers are case-insensitive. |
| **CODESYS** (and CODESYS-derived IDEs) | `false` | CODESYS folds identifiers case-insensitively. |
| **Beckhoff TwinCAT** | `false` | Same as CODESYS / standard. |
| **B&R Automation Studio** | `true` | B&R treats `Motor` and `motor` as two distinct variables. |

Pick the value that matches the IDE your code is **compiled in**. Setting it the wrong way can either **hide real bugs** (too loose) or **invent false ones** (too strict).

## What it changes

### `false` — case-insensitive (default)

The engine treats identifiers that differ only in case as the same symbol — same as the IEC standard, same as CODESYS / TwinCAT.

- A constant declared `MaxCount` is resolved when referenced as `MAXCOUNT`, so checks like `DIVISION_BY_ZERO` and `LOOP_BOUNDS_REVERSED` can read its value.
- A local `level` shadowing a global `Level` fires `VARIABLE_SHADOWING`.
- A standard timer parameter written `pt := T#5s` is found by `TIMER_PT_ZERO` / `TIMER_VALUE_CHANGED` even though their lookup spells it `PT`.
- An enum value renamed case-only (`idle` → `IDLE`) is **not** flagged by `ENUM_VALUE_REMOVED` — it's still the same value.
- `IDENTIFIER_CASE_MISMATCH` **fires** to flag references whose case drifted from the declaration (e.g. `iCount` declared, `ICOUNT` used).

### `true` — case-sensitive (B&R)

Identifiers are matched **exactly**. A different case is a different (or undefined) symbol, not a style slip.

- `VARIABLE_SHADOWING` only fires on an **exact-case** match between the local and the global.
- An enum value renamed case-only (`idle` → `IDLE`) **is** reported as a removal — it really is a different value in this dialect.
- `IDENTIFIER_CASE_MISMATCH` is **automatically disabled** in this mode. The right check for a case-different reference is "is this an undefined symbol?", not a style nit.

## Example

```yaml
# .plc-st-review.yml — for a B&R Automation Studio project
case_sensitive: true
```

```yaml
# .plc-st-review.yml — for a TwinCAT or CODESYS project (or omit the key entirely)
case_sensitive: false
```

The same setting drives every identifier comparison in the engine — globals, enums, named call arguments, scope lookups — so insertion and lookup always agree.
