# Parsing limits

Each `.st` file is parsed by the tree-sitter grammar running as WebAssembly. To keep a single pathological or hostile file from blowing up memory in the parser, the engine enforces a per-file **source-length cap**. Files larger than the cap are skipped with a one-line stderr warning naming the path and treated as **empty** by every downstream check (so they neither fire findings nor crash the run).

## The knobs

### Config — persistent

```yaml
# .plc-st-review.yml
parsing:
  max_file_size_bytes: 1000000   # default: 1 MB
```

`0` disables the cap entirely. Negative values are coerced to `0`.

### CLI — per-run override

```sh
plc-st-review --lint "src/**/*.st" --max-file-size 0          # parse everything, no cap
plc-st-review --lint "src/**/*.st" --max-file-size 5000000    # raise to 5 MB for this run
```

`--max-file-size` overrides whatever is in the config for the current invocation. It's there for ad-hoc cases (e.g. one big generated FB you want to lint once) without permanently relaxing the cap for the whole repo.

## When to raise or disable it

The default 1 MB cap is conservative — almost every hand-written ST file is **far** below it. Raise it only when:

- Your toolchain generates ST files programmatically and some legitimately cross the cap (e.g. large auto-generated state tables).
- You're profiling against the upper bound and intentionally exercising the parser.

Disable it (`0`) only when you **trust every file in scope** — for example, when linting your own first-party code in a `--lint` run. In CI on a PR-review path the cap is what stops a hostile file from exhausting parser memory, so leaving the default is the safe choice.

## What you'll see when a file is skipped

```text
plc-st-review: skipping src/generated/MEGA_FB.st (size 1234567 > cap 1000000); treated as empty
```

The skip is opportunistic and silent for downstream checks — the file doesn't appear in the findings list at all, neither as a pass nor as a failure. Raising the cap (or disabling it) and re-running is the way to bring the file back into scope.
