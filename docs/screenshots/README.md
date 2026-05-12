# Screenshots

The README embeds **one** screenshot from this directory:

- `single-finding.png` — a single inline review comment from PR #1, used as
  the visual hero in the README. ~720 px wide.

## How to capture `single-finding.png`

The current featured finding is `FB_INSTANCE_NEVER_CALLED` at
`examples/state-machine/FB_Diagnostics.st:42`. Pick a different one if you'd
rather feature it.

1. Open https://github.com/HeytalePazguato/plc-st-review/pull/1
2. Switch to the **Files changed** tab.
3. Scroll to `examples/state-machine/FB_Diagnostics.st`, then to the line
   with the comment (line 42 for `FB_INSTANCE_NEVER_CALLED`).
4. **Zoom** with `Ctrl/Cmd +` until the comment fills a comfortable
   horizontal region (the goal is the comment itself, not the surrounding
   diff context — a few lines above + the comment + a few lines below is
   plenty).
5. Capture just the comment region. On Windows: `Win+Shift+S` and drag a
   rectangle around it. On macOS: `Cmd+Shift+4` and drag.
6. Save as `single-finding.png` (PNG, ≤ 300 KB ideal) here.
7. `git add docs/screenshots/single-finding.png && git commit && git push`.

The README's `<img>` tag is already wired to that path.

## When to swap the featured finding

Pick the one that best showcases the tool's value to a first-time visitor.
Strong candidates:

- `FB_INSTANCE_NEVER_CALLED` (current default) — domain-specific, makes the
  PLC niche obvious immediately.
- `TIMER_VALUE_CHANGED` — eye-catching severity-by-ratio rendering ("10×
  faster") that no generic linter does.
- `CALL_SITE_OUTDATED` — cross-file analysis, shows the engine reasons over
  the whole repo, not just the diff.

To change the featured finding, edit the README image alt-text and the
markdown fallback block underneath the `<img>` tag.

## Update cadence

Whenever the visual output changes meaningfully (new severity badge, new
inline-comment markup format). Once per minor release is plenty.
