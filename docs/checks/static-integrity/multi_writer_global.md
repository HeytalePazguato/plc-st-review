# MULTI_WRITER_GLOBAL

**Severity:** `error`.
**Scope:** project (needs `--project-scope`; off otherwise).
**PLCopen:** CP26 — a global variable shall be written by at most one PROGRAM.

A `VAR_GLOBAL` is assigned to from inside more than one PROGRAM (across the whole repo). The classic concurrency hazard on a PLC: tasks interleave, the "last writer wins" behaviour depends on scan order, and the value the rest of the system sees can flip cycle-to-cycle.

**Settings.** No check-specific config. Like `DEAD_POU_INTRODUCED`, this is a project-scope check — it only fires when the engine is invoked with `--project-scope` (or the `project-scope:` input on the GitHub Action), because it needs the whole-repo symbol table to see every writer.

**Trigger.**

```pascal
(* Globals.st *)
VAR_GLOBAL
    gFlow : REAL;
END_VAR

(* PRG_A.st *)
PROGRAM PRG_A
gFlow := rNominal;
END_PROGRAM

(* PRG_B.st *)
PROGRAM PRG_B
gFlow := rManual;          (* fires — PRG_A also writes gFlow *)
END_PROGRAM
```

**The bot posts.**

```
🟥 error  MULTI_WRITER_GLOBAL
Global 'gFlow' is written by 2 PROGRAMs: PRG_A, PRG_B (PLCopen CP26)
```

**Fix.** Designate one PROGRAM as the owner of the global; have the others read or use a separate global / FB instance. The runtime can't safely arbitrate concurrent writes for you.
