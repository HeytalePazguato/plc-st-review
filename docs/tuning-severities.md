---
layout: default
title: Tuning severities
---

# Tuning severities

Every check ships with a default severity, but every shop weighs ST
changes differently. Use `.plc-st-review.yml` at your repo root to
override.

## Three things you can do

### 1. Pin a category to a specific severity

```yaml
severity_overrides:
  TIMER_VALUE_CHANGED: error
  CONSTANT_VALUE_CHANGED: warn
```

Effects:
- The runtime severity is replaced wholesale (even for checks like
  `TIMER_VALUE_CHANGED` that normally vary by magnitude).
- `severity_overrides` runs before `reporting.fail_on_severity`, so
  pinning a check to `error` is a quick way to make it merge-blocking.

### 2. Disable a category entirely

```yaml
disabled_checks:
  - COMMENT_ONLY
  - PRAGMA_CHANGED
```

The engine never runs disabled checks, so they cost nothing.

### 3. Adjust safety-critical detection

`CONSTANT_VALUE_CHANGED` elevates `info` → `warn` for any constant
whose name starts with a configured prefix. Tune for your shop's
naming convention:

```yaml
safety_critical_prefixes:
  - SAFETY_
  - INTERLOCK_
  - SIL_
  - LIMIT_
  - MAX_
  - MIN_
```

## Two failure thresholds you can set

```yaml
reporting:
  fail_on_severity: error    # default: error
  comment_style: inline      # inline | summary | both
```

- `fail_on_severity` controls when the CLI / CI job exits non-zero.
  In GitLab/GitHub modes the comment posting still runs to completion
  regardless of the exit code.
- `comment_style: summary` forces the GitLab/GitHub poster to skip
  inline comments and post a single summary table. Useful when the
  signal-to-noise is bad in early adoption and you want to look at
  the whole picture in one place.

## Tuning over time

A pragmatic ramp:

1. **Week 1:** install with all defaults, `fail_on_severity: error`.
   Watch what fires on real MRs.
2. **Week 2:** disable any check that's consistently noisy (often
   `COMMENT_ONLY` and `PRAGMA_CHANGED`).
3. **Week 3:** promote any `warn` your team always wants to block
   merge — typically `TIMER_VALUE_CHANGED` for safety-touched code.
4. **Steady state:** revisit the config when team feedback collects.
   The config is intentionally small so re-tuning is cheap.

## Baselining an existing repo

If you adopt `plc-st-review` mid-project, the first run can light up
with findings about long-shipped code. Two options:

- Run once with `--output json --out-file baseline.json`, commit
  `baseline.json`, and (in a future release) point the CLI at it via
  `--baseline baseline.json` so prior findings are filtered out.
- Or: temporarily set `reporting.fail_on_severity: error` plus
  `severity_overrides` that promote only the categories you care
  most about. Tighten as the codebase catches up.
