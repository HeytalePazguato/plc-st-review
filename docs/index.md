# plc-st-review

Semantic code review for IEC 61131-3 Structured Text pull/merge requests.

[View on GitHub](https://github.com/HeytalePazguato/plc-st-review){ .md-button .md-button--primary }
[Install from npm](https://www.npmjs.com/package/plc-st-review){ .md-button }

## What it does

`plc-st-review` parses the `.st` files in your pull/merge request with a
real tree-sitter grammar and posts inline review comments for the
semantic problems it finds — signature drift, outdated call sites, enum
removals, FB-instance misuse, naming-convention drift, division by zero,
unreachable code, and many more. The full list is in the
[Checks reference](checks-reference.md).

It runs:

- as a **GitHub Action** on pull requests — see [GitHub setup](github-setup.md)
- as a **GitLab CI job** on merge requests — see [GitLab setup](gitlab-setup.md)
- as a **CLI** locally (`npx plc-st-review --base <ref> --head <ref>`)

## Install

```sh
npm install -g plc-st-review
```

See the [README](https://github.com/HeytalePazguato/plc-st-review#readme) for
the full check catalog and configuration reference.

## Links

- [Issues](https://github.com/HeytalePazguato/plc-st-review/issues)
- [Discussions](https://github.com/HeytalePazguato/plc-st-review/discussions)
- [Releases](https://github.com/HeytalePazguato/plc-st-review/releases)
- [Security policy](https://github.com/HeytalePazguato/plc-st-review/blob/main/SECURITY.md)
