# Deterministic by design — no LLM in the loop

`plc-st-review` is a **deterministic** static analyzer. The same `.st` file always produces the exact same findings, in the same order, regardless of who runs it, where, or when. There is no LLM, no language model, no probabilistic ranker, and no network call to a third-party reviewer service anywhere in the analysis path.

This page exists because that's a deliberate choice, not an oversight — and the choice is worth four properties an AI-based code reviewer can't match.

## What "deterministic" means here

Every finding is produced by a check module under [`src/engine/checks/`](https://github.com/HeytalePazguato/plc-st-review/tree/main/src/engine/checks) that operates on the tree-sitter AST and the symbol table. Each module is a pure function of `(before AST, after AST, config)` → `findings[]`. Given the same inputs, it emits the same outputs — byte-for-byte. There's no temperature, no sampling, no model version drift, no "the bot decided to be quiet today."

You can read every check in under a screen of TypeScript and reason about exactly when it will fire. The behavior is contractually pinned by [the test suite](https://github.com/HeytalePazguato/plc-st-review/tree/main/test) — every check has at least one real-parser regression test that locks down the exact line and category it reports on a known fixture.

## Why this matters

### Reproducible

A finding that fires today fires tomorrow on the same input. There's no "the model has been updated, please re-run." When two engineers run the tool on the same branch, they see the same comments — no need to compare screenshots, no "it didn't flag that for me." When CI reruns a job on a flake, the second run's output matches the first.

That makes findings **citable**: linking to `FB_Conveyor.st:26  TIMER_VALUE_CHANGED` in a code review or postmortem points to something that will still be there six months from now, not a probabilistic snapshot that can't be reproduced.

### Auditable

Every finding maps to one named check with source code you can read. When a finding is wrong, you can open the check file, follow the logic, and fix it (or rule it a false-positive in your config). There's no opaque scoring you have to take on faith. For regulated industries (medical, automotive, energy, pharma) where a static-analysis pipeline is part of the safety/compliance story, this auditability is the difference between "evidence we can show an inspector" and "a black box we trust."

The check sources also serve as documentation of intent: each one carries a short comment explaining the rule, why it matters, and the edge cases it handles. A reviewer asking "why did the bot flag this?" gets a specific, fixed answer.

### Air-gappable

The shipped Docker image (`ghcr.io/heytalepazguato/plc-st-review:v0`) bundles everything the analyzer needs — Node, the tree-sitter grammar, the engine. Once mirrored to your internal registry, the tool runs on an offline runner with **zero outbound traffic**. No model-host endpoints to allowlist, no API tokens for an external reviewer service, no SaaS dependency that goes down at 03:00.

For shops that run PLC code on isolated production networks (which is most of them), this is the difference between "we can use it" and "legal says no."

### Your code never leaves the network

Tree-sitter parsing and the symbol-table builder run **in-process** in the CI job that ran the tool. The `.st` source is read from the checked-out workspace, the AST stays in memory, findings are written back to the GitHub/GitLab API on the same machine. Nothing is sent to a third party. There's no "we promise we don't train on your code" disclaimer to evaluate — the architecture makes it impossible.

This matters even for code that isn't strictly proprietary: PLC source typically encodes safety logic, vendor part numbers, calibration constants, customer-specific behavior, and timing assumptions that the customer never agreed to have anywhere but the runner that built it.

## When you actually want an LLM

There's a narrow place where an LLM is genuinely additive: **paraphrasing a deterministic finding in plain English** for a less-experienced reviewer (`TIMER_VALUE_CHANGED: T#2s → T#200ms (10.0× faster)` becomes "Timer T_StartupDelay's preset was cut from 2 seconds to 200 milliseconds — make sure the downstream conveyor handoff still has enough settling time"). That's a translation problem, not a detection problem.

The [roadmap](https://github.com/HeytalePazguato/plc-st-review#roadmap) keeps the door open for an opt-in `--explain` flag that does exactly this: every explanation grounded in a deterministic finding, the model never surfacing new issues on its own. If/when it ships, it will be off by default, opt-in per-finding, and explicitly documented as the one place where the engine talks to an external service.

## What this is NOT

- It is **not** an argument that LLM-based code review is useless. It's an argument that **PLC code review is not the place for it** — the cost of a non-reproducible finding (in regulated environments, on production-critical safety logic) outweighs the gain from a more eloquent summary.
- It is **not** a claim that determinism = correctness. Deterministic checks can still be wrong; the test suite is what keeps them honest, not the absence of an LLM.
- It is **not** a permanent commitment never to use a language model anywhere. The `--explain` paraphrase mode is the only place we expect to revisit.

## Comparing positioning

| | plc-st-review | LLM-based reviewers (CodeRabbit, Cursor Bugbot, etc.) |
|---|---|---|
| Same input → same output | always | varies with model version & temperature |
| Findings auditable to a fixed rule | yes, one TS module per check | no, emergent from model weights |
| Offline / air-gapped | yes, single Docker image | no, requires model-host API |
| Source code never leaves your network | yes | typically sent to a third-party endpoint |
| Per-finding source citation | check file + test fixture | model attribution at best |

The two approaches are not in zero-sum competition — they solve different problems. But on PLC code, where one wrong timer value can crash a conveyor at 03:00, deterministic wins by default.
