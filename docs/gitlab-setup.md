# GitLab setup

`plc-st-review` runs as a regular GitLab CI job and posts inline discussions on every merge request that touches an `.st` file. This page walks through getting it wired up on a real project.

## Minimal `.gitlab-ci.yml`

```yaml
plc-st-review:
  image: ghcr.io/heytalepazguato/plc-st-review:latest
  stage: review
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        - "**/*.st"
        - "**/*.ST"
  variables:
    GITLAB_TOKEN: $CI_JOB_TOKEN
    GITLAB_URL: $CI_SERVER_URL
    GITLAB_PROJECT_ID: $CI_PROJECT_ID
  script:
    - plc-st-review --gitlab --mr "$CI_MERGE_REQUEST_IID"
```

That's the whole job. The `image` ships with `node`, `tree-sitter`, `tree-sitter-iec61131-3-st`, and the patched bindings already built.

## Permissions

The job needs `api` scope to read the MR diff and post discussions. Two options:

- **`CI_JOB_TOKEN`**: the default in the snippet above. Works out-of-the-box when your project allows job-token API access. Some self-hosted instances disable this; check *Settings → CI/CD → Token permissions*.
- **Project access token**: create one with `api` scope and set it as a masked, protected CI variable named `GITLAB_TOKEN`. Then drop the `GITLAB_TOKEN: $CI_JOB_TOKEN` line.

## Self-hosted GitLab

`GITLAB_URL` defaults to `https://gitlab.com`. On self-hosted, the example sets it from `$CI_SERVER_URL` (auto-provided by GitLab Runner), no extra config needed.

## How config is loaded on an MR

In MR mode (`--gitlab`) the engine loads `.plc-st-review.yml` from the **base commit** (the MR's target branch — usually `main`), **not** from the checked-out MR head. That matters for the same reason it does on GitHub: the working directory in CI holds the MR-head code, which on a fork MR is contributor-controlled, so reading config from the head would let a malicious MR change which rules ran. Loading from base keeps a maintainer in control of the config that gates the review.

The engine tries `.plc-st-review.yml` then `plc-st-review.yml` at `context.baseSha` via the GitLab API. If neither exists at base, defaults are used (the cwd is **not** consulted in MR mode). An explicit `--config <path>` argument still wins:

```yaml
script:
  - plc-st-review --gitlab --mr "$CI_MERGE_REQUEST_IID" --config .plc-st-review.yml
```

**Practical consequence:** config changes proposed inside an MR don't take effect on that same MR's review — they apply only after merge. To iterate on the config itself, use `--config` against the new file for that MR, or run the engine locally.

## What the bot does on re-run

Each comment ships with a hidden marker (`<!-- plc-st-review:v1 kind=finding key=... -->`). On the next run:

- Discussions whose finding key matches and whose body is unchanged are left alone.
- Discussions whose body changed get edited in place.
- Discussions whose finding has disappeared (e.g. the issue was fixed) are resolved.
- New findings get new inline discussions.

No discussion is ever duplicated, and no human comment is touched unless it happens to start with the marker prefix.

## Common gotchas

- **More than 100 findings:** the bot falls back to a single summary comment instead of 100 inline notes. Tune `reporting.comment_style: summary` to force this behavior at any count.
- **Discussion is created but immediately resolved as "outdated":** GitLab marks an inline discussion as outdated if the line moved in a subsequent commit. Push a fixup that addresses the finding and the comment will track or be re-created on the next run.
- **403 on the discussions endpoint:** your job token doesn't have `api` scope. Switch to a project access token.
- **Self-hosted with self-signed TLS:** export `NODE_EXTRA_CA_CERTS` in the job to point at your CA bundle.
