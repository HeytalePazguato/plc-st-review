# HARDCODED_CREDENTIALS

**Severity:** `error`

A variable whose name matches a password / secret / API-key / token / credential / private-key pattern is initialised with a non-empty literal STRING value.

**Why it matters.** IEC 62443-4-1 SI-1 and 62443-4-2 CR 1.5: credentials shall not be hard-coded into the component. A literal initialiser commits the secret to version control, build artifacts, and every backup forever — anyone with read access has the credential. Industrial CVE writeups consistently call this out as the highest-frequency finding in OT codebases.

**Settings.** No check-specific config in v0.x. The secret-name pattern set is fixed (`password`, `passwd`, `pwd`, `secret`, `apikey`, `api_key`, `apitoken`, `credential`, `cred`, `private_key`, `sshkey`); future versions may expose it through `.plc-st-review.yml`.

**Allowed placeholders.** The check skips obvious placeholder values: empty string, `<...>`, `***`, `xxx`, `CHANGEME`, `TODO`, `PLACEHOLDER`. The developer is signalling "to be filled in by the integrator" and a finding there is noise.

**Trigger.**

```pascal
VAR_GLOBAL
    sAdminPassword : STRING := 'hunter2';     (* fires *)
    sApiKey        : STRING := 'sk-1234567890'; (* fires *)
    sStationName   : STRING := 'LineA-3';     (* OK — not a secret-shaped name *)
    sPlaceholder   : STRING := '<CHANGE_ME>'; (* OK — placeholder *)
END_VAR
```

**The bot posts.**

```
🟥 error  HARDCODED_CREDENTIALS
Hard-coded credential in 'sAdminPassword' (IEC 62443-4-2 CR 1.5)
```

**Fix.** Replace the literal initialiser with a runtime read from a configuration store, a fieldbus parameter, or a key-management facility. **Rotate the leaked value** — once a credential touches a repository it should be treated as compromised, even after the commit is reverted (git history, mirrors, backups, CI logs all retain it).
