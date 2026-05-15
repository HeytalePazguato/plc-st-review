"""Split docs/checks-reference.md into one file per check, grouped by category.

Run once after merging the giant monolithic file into the MkDocs migration.
After this runs, docs/checks-reference.md becomes the index page (intro +
common settings + category links + footer); each check gets its own page
under docs/checks/<category>/<check_lower>.md.

Deleted, not amended: the original 1900-line file is fully replaced.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "checks-reference.md"
CHECKS_DIR = ROOT / "docs" / "checks"

# (slug, H1-line-as-written-in-source)
CATEGORIES = [
    ("diff-based", "# Diff-based checks"),
    ("static-integrity", "# Static integrity checks"),
    ("fb-instance", "# FB-instance checks"),
    ("code-quality", "# Code-quality and style checks"),
]
CATEGORY_TITLE = {
    "diff-based": "Diff-based checks",
    "static-integrity": "Static integrity checks",
    "fb-instance": "FB-instance checks",
    "code-quality": "Code-quality and style checks",
}
CATEGORY_BLURB = {
    "diff-based": "These compare the *before* and *after* trees of a PR. Every finding implies a change happened in this PR.",
    "static-integrity": "These run on the *after* tree alone and surface bugs that compile but mis-behave. Each one filters out findings already present in the *before* tree so the check only flags **new** problems introduced in the PR.",
    "fb-instance": "These target standard IEC 61131-3 function-block patterns (`TON`, `CTU`, `R_TRIG`, `SR`/`RS`, etc.) — wiring mistakes that won't trip a normal compiler but produce wrong runtime behavior.",
    "code-quality": "These are stylistic / hygiene checks. Most ship at `info` severity and stay off your blocking gate by default; raise them in `.plc-st-review.yml` once your team agrees on a convention.",
}


def split_categories(text: str) -> dict[str, str]:
    """Return {category_slug: body_text_between_its_H1_and_the_next_H1}."""
    out: dict[str, str] = {}
    remaining = text
    for i, (slug, header) in enumerate(CATEGORIES):
        idx = remaining.find(header)
        if idx == -1:
            raise SystemExit(f"category header not found: {header!r}")
        # Drop everything up to and including the H1 line.
        after_header = remaining[idx + len(header):]
        # Find the next category's H1 (or the footer / EOF).
        next_idx = None
        for next_slug, next_header in CATEGORIES[i + 1:]:
            j = after_header.find(next_header)
            if j != -1:
                next_idx = j
                break
        if next_idx is None:
            # Last category — body ends at the "Using a check in your PR" footer
            # (top-level H1), or EOF.
            footer = after_header.find("\n# Using a check in your PR")
            next_idx = footer if footer != -1 else len(after_header)
        body = after_header[:next_idx].strip("\n")
        out[slug] = body
        remaining = after_header[next_idx:]
    return out


CODE_FENCE = re.compile(r"^```")


def split_checks(category_body: str) -> list[tuple[str, str]]:
    """Yield (CHECK_NAME, full_check_body_starting_at_H2) per check.

    Skips `##` lines that fall inside a fenced code block.
    """
    lines = category_body.splitlines()
    checks: list[tuple[str, str]] = []
    in_fence = False
    current: list[str] | None = None
    current_name: str | None = None
    for line in lines:
        if CODE_FENCE.match(line):
            in_fence = not in_fence
        is_check_heading = (
            not in_fence
            and line.startswith("## ")
            and re.match(r"^## [A-Z][A-Z0-9_]+\s*$", line) is not None
        )
        if is_check_heading:
            if current is not None and current_name is not None:
                checks.append((current_name, "\n".join(current).rstrip() + "\n"))
            current_name = line[3:].strip()
            current = [line]
            continue
        if current is not None:
            current.append(line)
    if current is not None and current_name is not None:
        checks.append((current_name, "\n".join(current).rstrip() + "\n"))
    return checks


def to_check_file(category_slug: str, check_name: str, body: str) -> Path:
    """Write per-check page; H2 becomes H1."""
    slug = check_name.lower()
    dest = CHECKS_DIR / category_slug / f"{slug}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Replace the leading "## CHECK_NAME" with "# CHECK_NAME"
    first_nl = body.find("\n")
    body = "# " + body[3:first_nl].strip() + body[first_nl:]
    # Strip trailing "---" separators that were section dividers in the mono file.
    body = re.sub(r"\n---\s*$", "\n", body)
    dest.write_text(body, encoding="utf-8")
    return dest


# Build a global check-name -> new-path map so we can rewrite cross-links.
def write_pages() -> dict[str, str]:
    src = SRC.read_text(encoding="utf-8")
    bodies = split_categories(src)
    locations: dict[str, str] = {}
    for slug, body in bodies.items():
        for name, check_body in split_checks(body):
            path = to_check_file(slug, name, check_body)
            locations[name] = f"checks/{slug}/{name.lower()}.md"
            print(f"  {slug}/{name.lower()}.md  ({len(check_body.splitlines())} lines)")
    return locations


def rewrite_cross_links(locations: dict[str, str]) -> None:
    """Rewrite #anchor_lower references between check pages."""
    for slug in {p.split("/")[1] for p in locations.values()}:
        cat_dir = CHECKS_DIR / slug
        for f in cat_dir.glob("*.md"):
            text = f.read_text(encoding="utf-8")
            original = text
            for name, target in locations.items():
                anchor = name.lower()
                # `[FOO](#foo)`  →  relative path
                # `(#foo)` is rewritten to a relative .md link.
                # Compute the relative path from this file to the target.
                rel = _rel_path(f.parent, ROOT / "docs" / target)
                text = text.replace(f"](#{anchor})", f"]({rel})")
            if text != original:
                f.write_text(text, encoding="utf-8")


def _rel_path(from_dir: Path, to_file: Path) -> str:
    """Compute a POSIX-style relative path."""
    rel = Path(__file__).resolve()  # placeholder
    from_dir = from_dir.resolve()
    to_file = to_file.resolve()
    # Simple manual rel computation since Python's Path.relative_to needs ancestor.
    fp = from_dir.parts
    tp = to_file.parts
    i = 0
    while i < len(fp) and i < len(tp) and fp[i] == tp[i]:
        i += 1
    up = [".."] * (len(fp) - i)
    down = list(tp[i:])
    return "/".join(up + down)


def write_index(locations: dict[str, str]) -> None:
    """Replace docs/checks-reference.md with a thin index page."""
    parts: list[str] = []
    parts.append("# Checks reference\n")
    parts.append(
        "Every check `plc-st-review` ships with — what it catches, why it "
        "exists, how to configure it, an ST trigger, what the bot posts, and "
        "a suggested fix. See [`check-limitations.md`](check-limitations.md) "
        "for what each check deliberately *doesn't* catch.\n"
    )
    parts.append(
        "**Live demo:** every check in this document fires at least once on "
        "[PR #1](https://github.com/HeytalePazguato/plc-st-review/pull/1), "
        "where you can see the exact inline comments the bot posts.\n"
    )
    parts.append("## Common settings (apply to every check)\n")
    parts.append("Two knobs work on every check, set in `.plc-st-review.yml`:\n")
    parts.append(
        "```yaml\n"
        "severity_overrides:\n"
        "  CATEGORY_NAME: error      # raise / lower the severity for this category\n"
        "disabled_checks:\n"
        "  - CATEGORY_NAME           # turn the check off entirely\n"
        "```\n"
    )
    parts.append(
        "Each per-check page below only lists **additional** knobs "
        "(check-specific config, prefix lists, etc.).\n"
    )

    by_cat: dict[str, list[str]] = {slug: [] for slug, _ in CATEGORIES}
    for name, path in locations.items():
        slug = path.split("/")[1]
        by_cat[slug].append(name)
    for slug, _ in CATEGORIES:
        parts.append(f"## {CATEGORY_TITLE[slug]}\n")
        parts.append(f"{CATEGORY_BLURB[slug]}\n")
        for name in by_cat[slug]:
            parts.append(f"- [{name}](checks/{slug}/{name.lower()}.md)")
        parts.append("")
    parts.append("## Using a check in your PR\n")
    parts.append(
        "`plc-st-review` runs automatically once you've set up the GitLab or "
        "GitHub integration (see [`gitlab-setup.md`](gitlab-setup.md) / "
        "[`github-setup.md`](github-setup.md)). Every check above lands as "
        "either an inline comment on the relevant `.st` line or as part of "
        "the summary issue / discussion comment when the affected line "
        "falls outside the PR's diff hunks.\n"
    )
    parts.append(
        "To suppress a check for a single repo, add it to `disabled_checks` "
        "in `.plc-st-review.yml`. To raise or lower its severity, use "
        "`severity_overrides`. See [`tuning-severities.md`](tuning-severities.md) "
        "for the tuning ramp.\n"
    )
    parts.append(
        "To compose policy across many repos — naming conventions, severity "
        "profiles, forbidden symbols — use `extends:` to pull from shared "
        "preset files. See [`preset-packs.md`](preset-packs.md).\n"
    )
    SRC.write_text("\n".join(parts), encoding="utf-8")


def main() -> None:
    print("splitting checks…")
    locations = write_pages()
    print(f"\n{len(locations)} check pages written.")
    print("rewriting cross-links…")
    rewrite_cross_links(locations)
    print("rewriting index page…")
    write_index(locations)
    print("\nDone. New layout:")
    print(f"  {SRC.relative_to(ROOT)} — index")
    for slug, _ in CATEGORIES:
        count = sum(1 for v in locations.values() if v.startswith(f"checks/{slug}/"))
        print(f"  docs/checks/{slug}/  ({count} pages)")


if __name__ == "__main__":
    main()
