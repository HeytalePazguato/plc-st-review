# Project scope (`--project-scope`)

Most checks work from a PR's diff alone. One does not: [`DEAD_POU_INTRODUCED`](checks/diff-based/dead_pou_introduced.md) has to know whether a *newly added* POU has any caller anywhere in the repo, including files the PR never touched. Answering that needs a **whole-repo parse**, which is more expensive than a diff and pointless to run on every PR.

So it is **opt-in and on demand**, controlled by `--project-scope`:

```sh
# Local: review the branch against main, with a whole-repo parse
plc-st-review --base main --head HEAD --project-scope

# Override the default glob (`**/*.st`)
plc-st-review --base main --project-scope "PLC/**/*.st"
```

Without the flag, project-scoped checks are skipped and the engine prints a one-line note to stderr, it never guesses. The whole-repo files are read from the checked-out working tree, so a full checkout is required (`fetch-depth: 0` in CI).

## Triggering it in CI: use a label

The recommended pattern is a separate, **label-gated** workflow. The normal review stays diff-only and fast on every PR; the deep pass runs only when you add a `full-audit` label to the PR. Full recipe: [`examples/github-workflow-project-scope.yml`](https://github.com/HeytalePazguato/plc-st-review/blob/main/examples/github-workflow-project-scope.yml).

```yaml
# .github/workflows/plc-st-review-audit.yml
on:
  pull_request:
    types: [labeled, synchronize, reopened]
jobs:
  full-audit:
    if: contains(github.event.pull_request.labels.*.name, 'full-audit')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # required: the whole tree must be on disk
      - uses: HeytalePazguato/plc-st-review@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          project-scope: '**/*.st'
```

Other triggers work the same way, anything that sets the `project-scope` input: a `workflow_dispatch` button for one-off audits, or a nightly `schedule` for continuous dead-code hygiene that never blocks a merge. The engine capability is the flag; *when* it runs is up to the trigger you choose.
