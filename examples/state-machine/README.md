# State-machine demo

This is the fixture used by the repo's self-review workflow
(`.github/workflows/plc-st-review.yml`). It models a small conveyor
controller with:

- A typed state enum in `E_ConveyorState.st`.
- A function block in `FB_ConveyorState.st` that CASE-switches over the
  enum and uses a `TON` timer + a `FOR` loop.
- A program in `Conveyor_HMI.st` in a separate file that also
  CASE-switches over the same enum — so changes to the enum may
  affect both files.
- Global constants and a non-constant global in `Globals.st`.

When a PR modifies any of these files, the `plc-st-review` GitHub Action
runs and posts inline review comments for whatever semantic changes it
finds. To see it in action, edit one of these files in a branch, open a
PR, and wait for the bot.

## Baseline files for the canonical demo

The remaining files — `FB_Base.st`, `FB_Legacy.st`, `FB_SpeedCalc.st`,
`I_Diagnostic.st`, `FB_DiagUnit.st`, `E_DiagMode.st`, `FB_AxisRamp.st`,
`FB_Watchdog.st` — are deliberately *clean*. They exist as the "before"
state for the canonical demo PR (`test/state-machine-changes`), which
edits them to exercise the diff-based checks (POU_DELETED, POU_RENAMED,
ENUM_VALUE_REMOVED, INHERITANCE_CHANGED, ARRAY_BOUNDS_CHANGED, and so
on). On their own they produce no findings.

The included fixtures are deliberately compact — they're test material,
not production code.
