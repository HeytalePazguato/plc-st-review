#!/usr/bin/env python3
"""
One-shot sweep that removes em-dashes (U+2014) from the codebase and
replaces them with context-appropriate punctuation. Run once, then
deleted along with the commit.

Rules (in order):
  1. After a backtick or `**` close, ` — ` becomes `: ` (the bot/markdown
     formatters use em-dash as a label/value separator).
  2. ` — ` followed by an uppercase letter becomes `. ` (sentence
     boundary).
  3. ` — ` followed by anything else becomes `, ` (aside / continuation).
  4. Bare `—` (no surrounding spaces) becomes `,`.
"""

import re
import sys
from pathlib import Path

EM = "—"


def transform(text: str) -> str:
    # Bot/markdown formatter label-value: "...`X` — Y" or "...**X** — Y"
    text = re.sub(r"(`|\*\*)\s+—\s+", r"\1: ", text)

    # General prose: " — " followed by some non-space char.
    def repl(m: re.Match[str]) -> str:
        nxt = m.group(1)
        if nxt.isupper():
            return ". " + nxt
        return ", " + nxt

    text = re.sub(r"\s+—\s+(\S)", repl, text)

    # Stragglers: bare em-dash with no space, or at line boundaries.
    text = text.replace(EM, ",")
    return text


def main(argv: list[str]) -> int:
    changed = 0
    for path in argv:
        p = Path(path)
        if not p.is_file():
            continue
        src = p.read_text(encoding="utf-8")
        if EM not in src:
            continue
        new = transform(src)
        if new != src:
            p.write_text(new, encoding="utf-8")
            changed += 1
            print(f"  {path}")
    print(f"updated {changed} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
