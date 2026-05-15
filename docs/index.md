# plc-st-review

A **semantic linter, code reviewer, and team-style enforcer** for
IEC 61131-3 Structured Text, built for CI on PLC codebases that can't
be compiled outside the vendor IDE.

[View on GitHub](https://github.com/HeytalePazguato/plc-st-review){ .md-button .md-button--primary }
[Install from npm](https://www.npmjs.com/package/plc-st-review){ .md-button }

## What it does

`plc-st-review` parses `.st` files with a real tree-sitter grammar and
flags semantic problems, signature drift, outdated call sites, enum
removals, FB-instance misuse, naming-convention drift, division by zero,
unreachable code, and many more. The full list is in the
[Checks reference](checks-reference.md).

## Three modes

- **Static linter** (`--lint src/**/*.st`), run on every push. 35
  single-revision checks for ST bugs. Diff-based categories are
  auto-disabled. No PR or base ref needed.
- **PR / MR reviewer**: posts inline review comments on the lines
  that triggered findings. Adds 17 diff-based checks that compare the
  PR against its base.
- **Team-style enforcer**: drop a `.plc-st-review.yml` listing your
  `naming_conventions` and `forbidden_symbols`; both modes pick it up.

It runs:

- as a **CI linter** on every push (`plc-st-review --lint "src/**/*.st"`)
- as a **GitHub Action** on pull requests, see [GitHub setup](github-setup.md)
- as a **GitLab CI job** on merge requests, see [GitLab setup](gitlab-setup.md)
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
