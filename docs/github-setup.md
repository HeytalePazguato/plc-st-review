# GitHub setup

`plc-st-review` ships a GitHub Action that posts review comments on every pull request touching an `.st` file. The action is a thin wrapper around the container image, same engine, same checks, same config.

## Minimal workflow

`.github/workflows/plc-st-review.yml`:

```yaml
name: PLC ST Review

on:
  pull_request:
    paths:
      - '**/*.st'
      - '**/*.ST'

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: HeytalePazguato/plc-st-review@v0
```

The action infers everything from the PR context, no inputs are required for the common case.

## Permissions

The job needs `pull-requests: write` to post review comments. `contents: read` covers fetching file content. The default `GITHUB_TOKEN` provides both when the permissions block is set as shown.

## Optional inputs

```yaml
- uses: HeytalePazguato/plc-st-review@v0
  with:
    pr-number: ${{ github.event.pull_request.number }}  # default
    repo: ${{ github.repository }}                       # default
    severity: warn                                       # default: info
    config: .plc-st-review.yml                           # default: none
```

`severity` filters findings client-side before posting, useful when you want the bot to post nothing under a certain level even if your config emits them.

## How config is loaded on a PR

In PR mode (`--github`) the engine loads `.plc-st-review.yml` from the **base commit** (the PR's target branch — usually `main`), **not** from the checked-out PR head. That matters because:

- In CI the working directory holds the PR-head code, which on a **fork PR** is attacker-controlled. Reading config from the head would let a malicious PR change which rules ran, supply a catastrophic-backtracking regex, or use `extends:` to read arbitrary local files during config discovery.
- Loading from base means a maintainer always controls the config that gates the review.

The engine tries `.plc-st-review.yml` then `plc-st-review.yml` at the base SHA. If neither exists at base, defaults are used (the cwd is **not** consulted in PR mode). An explicit `config:` input still wins — that's the maintainer escape hatch if you really do want the PR-supplied file (e.g. when iterating on the config inside the PR that introduces it):

```yaml
- uses: HeytalePazguato/plc-st-review@v0
  with:
    config: .plc-st-review.yml   # bypasses base-ref loading; reads from the checked-out PR head
```

**Practical consequence:** config changes proposed inside a PR don't take effect on **that same PR's review** — they apply only after merge. If you're iterating on the config itself, either use the `config:` input above for that PR, or run the engine locally with `--config` against the new file.

## What the bot does on re-run

Each comment ships with a hidden marker (`<!-- plc-st-review:v1 kind=finding key=... -->`). On the next run:

- Review comments whose marker matches and whose body is unchanged are left alone.
- Review comments whose body changed are edited in place.
- Review comments whose finding has disappeared are deleted.
- New findings get new inline review comments tied to the PR's head commit.

The summary fallback comment is an issue comment (PRs are issues under the hood). It's updated rather than re-posted.

## Common gotchas

- **403 on `pulls.createReviewComment`:** your workflow is missing `pull-requests: write`. Add the `permissions:` block shown above.
- **GitHub Enterprise:** set `GITHUB_API_URL` to your enterprise API base (e.g. `https://github.example.com/api/v3`). The action picks it up automatically.
- **Posting from a fork:** workflows in fork PRs run with read-only tokens by default. Either enable PR-from-fork review with explicit reviewer approval, or use `pull_request_target` (with extra care about checking out trusted code).
- **More than 100 findings:** the bot falls back to a single issue comment instead of 100 inline review comments.
