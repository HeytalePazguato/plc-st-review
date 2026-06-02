# PERSISTENT_PLAINTEXT_SECRET

**Severity:** `error`

A `VAR_GLOBAL PERSISTENT` or `VAR_GLOBAL RETAIN` declaration's name matches a password / secret / API-key / token / credential / private-key pattern. The variable is stored in non-volatile memory of the PLC across power cycles.

**Why it matters.** IEC 62443-4-2 CR 4.1 (information confidentiality at rest): the component shall protect the confidentiality of information at rest. PERSISTENT / RETAIN variables are readable by anyone with engineering-tool access or physical access to the runtime — they appear in:

- backup dumps and retain-image extractions performed by maintenance staff,
- online-monitoring panes in the IDE,
- crash dumps and snapshots used for fault investigation,
- diagnostic logs that mirror retained state.

Even when there's no literal initialiser (which `HARDCODED_CREDENTIALS` already covers), the *shape* of "persistent storage of a secret-named variable" is itself the finding — the variable will eventually hold a value, and that value will then survive power cycles in cleartext.

**Settings.** No check-specific config in v0.x. The secret-name pattern set is shared with [`HARDCODED_CREDENTIALS`](hardcoded_credentials.md) so the two checks treat the same names as sensitive.

**Trigger.**

```pascal
VAR_GLOBAL PERSISTENT
    sAdminPassword : STRING;            (* fires *)
END_VAR

VAR_GLOBAL RETAIN
    sApiToken : STRING;                 (* fires *)
END_VAR

VAR_GLOBAL                              (* OK — not persistent *)
    sAdminPassword : STRING;
END_VAR

VAR_GLOBAL PERSISTENT                   (* OK — not a secret name *)
    iCycleCount : INT;
END_VAR
```

**The bot posts.**

```
🟥 error  PERSISTENT_PLAINTEXT_SECRET
Secret-named global 'sAdminPassword' is declared PERSISTENT/RETAIN — stored in plaintext NV memory (IEC 62443-4-2 CR 4.1)
```

**Fix.** Move the secret out of PERSISTENT storage. Three concrete options, in order of preference:

1. **Load at startup** from a key-management facility (vendor key store, sealed-storage HSM, network keystore). The runtime holds the secret in volatile memory only.
2. **Accept it as a `VAR_INPUT`** to the consuming POU and let the integrator supply it from configuration that lives outside the persistent image.
3. **Store only an irreversible hash** if equality comparison is all you need — comparing `HASH(input) = HASH(stored)` removes the cleartext from persistent memory entirely.
