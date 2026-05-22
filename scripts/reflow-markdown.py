#!/usr/bin/env python3
"""
Collapse hard-wrapped prose paragraphs and bullets in Markdown files to
single logical lines. Markdown renders single newlines as the same
paragraph, so the wraps add nothing to the output and just make edits
noisier (touching one sentence shifts wrap points across the whole
paragraph, producing larger diffs than necessary).

Rules:
  - Headers, blank lines, tables, blockquotes, and code blocks are
    passed through unchanged.
  - A bullet item (`-`, `*`, `+` followed by a space) absorbs any
    immediately-following continuation lines (indented more than the
    bullet marker, not themselves bullets) into one logical line.
  - Nested bullets (`  -`, `    -`, ...) stay as nested bullets.
  - A plain paragraph (lines between blank lines that are not bullets,
    headers, tables, quotes, or code fences) is joined into one line.

Usage: scripts/reflow-markdown.py <file1.md> [<file2.md> ...]
"""

import re
import sys
from pathlib import Path


def bullet_indent(line: str) -> int | None:
    m = re.match(r"^(\s*)([-*+])\s", line)
    return len(m.group(1)) if m else None


def is_continuation(line: str, parent_indent: int) -> bool:
    """A continuation line is indented more than the parent bullet marker
    AND is not itself a bullet (otherwise it's a nested bullet)."""
    if not line.strip():
        return False
    m = re.match(r"^(\s*)(\S)", line)
    if not m:
        return False
    if bullet_indent(line) is not None:
        return False
    return len(m.group(1)) > parent_indent


def reflow(text: str) -> str:
    out: list[str] = []
    lines = text.split("\n")
    i, n = 0, len(lines)
    in_code = False
    while i < n:
        line = lines[i]
        if line.lstrip().startswith("```"):
            in_code = not in_code
            out.append(line)
            i += 1
            continue
        if in_code:
            out.append(line)
            i += 1
            continue
        stripped = line.lstrip()
        if (
            not line.strip()
            or line.startswith("#")
            or stripped.startswith("|")
            or stripped.startswith(">")
        ):
            out.append(line)
            i += 1
            continue
        bi = bullet_indent(line)
        if bi is not None:
            chunk = [line.rstrip()]
            i += 1
            while i < n and is_continuation(lines[i], bi):
                chunk.append(lines[i].strip())
                i += 1
            out.append(" ".join(chunk))
            continue
        # Plain paragraph
        chunk = [line.rstrip()]
        i += 1
        while i < n:
            nxt = lines[i]
            if (
                not nxt.strip()
                or nxt.startswith("#")
                or bullet_indent(nxt) is not None
                or nxt.lstrip().startswith("```")
                or nxt.lstrip().startswith("|")
                or nxt.lstrip().startswith(">")
            ):
                break
            chunk.append(nxt.strip())
            i += 1
        out.append(" ".join(chunk))
    return "\n".join(out)


def main(argv: list[str]) -> int:
    changed = 0
    for p in argv:
        path = Path(p)
        if not path.is_file():
            continue
        src = path.read_text(encoding="utf-8")
        new = reflow(src)
        if new != src:
            path.write_text(new, encoding="utf-8", newline="\n")
            changed += 1
            print(f"  {p}")
    print(f"reflowed {changed} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
