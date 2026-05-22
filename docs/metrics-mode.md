# Metrics mode (`--metrics`)

`--metrics` computes code-quality and complexity metrics for a whole ST codebase and prints a report. It is a **standalone mode**: it does not run the review checks, it only measures. It reuses the same tree-sitter AST and symbol table as the reviewer, so there is no separate parser to install.

```sh
plc-st-review --metrics src/                                  # report for every .st under src/
plc-st-review --metrics src/ --sort complexity --top 20       # worst 20 POUs by complexity
plc-st-review --metrics src/ --threshold complexity=20        # exit nonzero if any POU exceeds 20
plc-st-review --metrics src/ --format json                    # machine-readable
plc-st-review --metrics src/ --format badge                   # shields.io URL for your README
plc-st-review --metrics src/ --format dot                     # Graphviz call graph
```

`--metrics` accepts the same path / glob syntax as `--lint`: literal files, directories (walked for `.st`), and `*` / `**` globs.

## What it measures

**Per POU:** cyclomatic complexity, max nesting depth, lines of code (and total / comment ratio), variable / input / output / method counts, statement / branch / return counts, and call-graph fan-in / fan-out. Each POU gets a 🟢 / 🟡 / 🔴 status from the configured [thresholds](checks-reference.md#metric-thresholds) (complexity, nesting, LOC, and fan-out bands).

**Project-wide:** total POUs / LOC / types / globals, average complexity and nesting, dead POUs (nothing calls them, `PROGRAM`s excluded), orphan types, longest dependency chain, call cycles, and doc coverage.

## Output formats

| `--format` | Output |
|---|---|
| `terminal` (default) | Human-readable report; ANSI colour on a TTY, plain when piped. |
| `json` | Full machine-readable report (`project` + `pous`), snake_case keys. |
| `dot` | Graphviz DOT of the POU call graph, nodes coloured by status. Pipe to `dot -Tsvg -o deps.svg`. |
| `badge` | A [shields.io](https://shields.io) URL for average complexity, e.g. `![Avg Complexity](URL)`. |

## CI gate

`--threshold <metric>=<value>` makes the command exit non-zero when any POU's metric exceeds the value, so you can fail a pipeline on runaway complexity. Accepts `complexity`, `nesting`, `loc`, `fan_in`, `fan_out`, and may be repeated:

```sh
plc-st-review --metrics src/ --threshold complexity=25 --threshold nesting=8
```

## Limitations

Metrics are computed from the syntax tree, so the same caveats as the reviewer apply (no runtime flow analysis). Two specifics worth knowing:

- **Methods roll up into their enclosing FUNCTION_BLOCK**; they are not reported as separate POUs.
- **Type tracking covers what the symbol table models** (notably enums). `STRUCT` types are not yet counted toward `total_types` or orphan detection, and an enum used only through bare, unqualified members may be reported as an orphan.
