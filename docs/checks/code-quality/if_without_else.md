# IF_WITHOUT_ELSE

**Severity:** `info` by default; `warn` under the PLCopen preset.

An `IF` (or `IF ... ELSIF ...`) statement is missing a final `ELSE`. The reasoning behind the check (echoed in PLCopen rule **L17**): the "neither branch holds" path should be explicit so a future reader knows the no-op was intentional, not forgotten. This is a style call and many teams legitimately use `IF` without `ELSE` for one-way actions, which is why the default severity is `info` — visible but non-blocking. Bump or mute in your own config to match team policy.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF x > 0 THEN
    x := x + 1;
END_IF;                          (* fires — no ELSE *)
```

**The bot posts.**

```
🟦 info  IF_WITHOUT_ELSE
IF statement without an ELSE clause (PLCopen L17)
```

**Fix.** Add an `ELSE ;` (even an empty one with a comment explaining why) so the no-op branch is intentional and visible.
