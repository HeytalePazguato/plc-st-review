# ARRAY_SINGLE_ELEMENT

**Severity:** `info`

`ARRAY [n..n] OF T` — bounds are equal, only one element.

**Why it matters.** Either the bounds are wrong or a scalar would
be clearer. Almost always a copy-paste artifact.

**Settings.** No check-specific config.

**Trigger.**

```pascal
arr : ARRAY [5..5] OF INT;         (* fires *)
```

**The bot posts.**

```
🟦 info  ARRAY_SINGLE_ELEMENT
Array arr declared with a single element [5..5]
An array of length one is usually a mistake.
```

**Fix.** Use a scalar (`arr : INT;`) or correct the bounds.
