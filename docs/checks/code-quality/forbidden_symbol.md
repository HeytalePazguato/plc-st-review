# FORBIDDEN_SYMBOL

**Severity:** `error` (config-driven, off by default)

An identifier matches an entry in the repo's `forbidden_symbols` blocklist.

**Why it matters.** Every team has a list of deprecated globals, unsafe vendor APIs, or banned legacy functions. Codifying the list in config beats a wiki page that nobody reads.

**Settings.**

```yaml
forbidden_symbols:
  - DangerousLegacyApi           # exact match
  - /^Deprecated_/               # regex inside slashes
  - /\bUnsafeRead\b/             # word-boundary regex
```

Off by default. Add at least one pattern to enable.

**Trigger.**

```pascal
DangerousLegacyApi();              (* fires when DangerousLegacyApi is blocked *)
```

**The bot posts.**

```
🟥 error  FORBIDDEN_SYMBOL
Forbidden identifier 'DangerousLegacyApi' is referenced
This identifier is on the repo-configured `forbidden_symbols`
blocklist. Replace it with the approved alternative.
```

**Fix.** Replace with the approved alternative, or remove the pattern from `forbidden_symbols` if you want to allow it again.
