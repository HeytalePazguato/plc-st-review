# Contributing to plc-st-review

Thanks for your interest! Contributions of any size are welcome, bug reports, fixes, new features, doc improvements.

## Branch flow

```
develop  →  release/<version>  →  main
```

- All feature work, bug fixes, and refactors target `develop`.
- `main` is reserved for stable releases, never PR directly to it.
- Release stabilization happens on `release/<version>` branches cut from `develop`.

See the [README's "Branching & releases"](README.md) section (or [`BLUEPRINT.md`](BLUEPRINT.md)) for the full versioning, tagging, and CI flow.

## The demo PR (#1) — never merge it

[PR #1](https://github.com/HeytalePazguato/plc-st-review/pull/1) (branch `test/state-machine-changes`) is the canonical live demo: it is kept **open and locked** so the self-review workflow posts every check as a real inline comment. It is **not** a feature branch.

- **Never merge `test/state-machine-changes` into `develop` or `main`, and never delete it.** It is a permanent, kept branch, the head of the live demo PR. Its commits are *intentionally broken* ST (a 10× timer change, an out-of-bounds index, division by zero, a forbidden symbol, an over-complex `FB_MetricsDemo`, a demo config) whose only job is to make the bot fire. Merging it back would dump all of that into the codebase; deleting it would close the demo PR.
- The flow is **one-directional**: merge `develop` *into* the demo branch periodically to keep its base current. Never the reverse. That's why the branch shows as "ahead of develop", that's correct and expected.
- The diff-based checks compare the demo branch against `develop`, so a check only fires if the relevant POU exists on **both** sides. The metric-regression checks come from `examples/state-machine/FB_MetricsDemo.st`: a simple baseline on `develop`, an expanded copy on the demo branch.
- `DEAD_POU_INTRODUCED` does **not** appear on the demo: it needs `--project-scope` (a whole-repo parse, too slow for every PR), which the demo workflow deliberately doesn't pass. The demo covers the always-on categories only.

### Updating the demo

```sh
gh pr unlock 1                                  # the lock blocks the bot's own posts
# edit fixtures on test/state-machine-changes, then push (triggers the self-review)
# verify the new comments landed on PR #1
gh pr lock 1 --reason resolved                  # locked is the resting state
```

A `failure` conclusion on the demo run is **expected** — the demo contains `error`-severity findings, so the action exits non-zero after posting. Confirm success via the log line `plc-st-review (github): inline, N created, ...` and the summary comment, not the run's red X.

## Pull requests

- One logical change per PR; keep diffs reviewable.
- Run lint + build + test locally before opening the PR.
- Update `CHANGELOG.md` under `[Unreleased]`.
- Don't bump `VERSION` in feature PRs, that happens on the release branch.
- The `ci` workflow must pass before a PR can merge.

## Commit messages

Conventional-commits style is appreciated:

```
feat: add <thing>
fix: handle <edge case>
docs: clarify <section>
chore(deps): bump <dep> from X to Y
ci: <workflow change>
```

The release-branch workflow looks for `[beta]` / `[rc]` keywords in commit messages to choose pre-release stages, keep those out of normal commits.

## Reporting bugs

Use the bug report template under "New Issue". A minimal reproducing example is gold.

## Asking questions / proposing ideas

Use [Discussions](https://github.com/HeytalePazguato/plc-st-review/discussions) for open-ended questions and ideas. Reserve issues for actionable bugs and concrete feature requests.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
