import type { AssignmentTarget, Check, Finding, Pou, SymbolTable } from '../types.js';

// PLCopen CP26 — a global variable shall be written by at most one PROGRAM.
// Multiple writers across PROGRAMs is the classic concurrency / race-
// condition shape on a PLC (tasks run interleaved; the "last writer wins"
// behaviour depends on scan order).
//
// This is a project-scope check: it needs the whole-repo symbol table to
// see all writers. When `--project-scope` isn't enabled, ctx.project is
// undefined and the check is skipped.

function enclosingProgram(scope: string, t: SymbolTable): Pou | null {
  let cur: string | undefined = scope;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const p = t.pous.get(cur);
    if (!p) return null;
    if (p.kind === 'program') return p;
    cur = p.parent;
  }
  return null;
}

function writerSet(t: SymbolTable): Map<string, Set<string>> {
  // Map from lowercased global name → set of qualified PROGRAM names that
  // write to it. Only writes from inside a PROGRAM count.
  const out = new Map<string, Set<string>>();
  for (const a of t.assignmentTargets) {
    if (!isGlobal(a, t)) continue;
    const prog = enclosingProgram(a.scope, t);
    if (!prog) continue;
    const k = a.name.toLowerCase();
    let progs = out.get(k);
    if (!progs) {
      progs = new Set();
      out.set(k, progs);
    }
    progs.add(prog.qualifiedName);
  }
  return out;
}

function isGlobal(a: AssignmentTarget, t: SymbolTable): boolean {
  // CaseMap-aware lookup honours the dialect's case sensitivity.
  return t.globals.has(a.name);
}

export const multiWriterGlobal: Check = {
  category: 'MULTI_WRITER_GLOBAL',
  defaultSeverity: 'error',
  scope: 'project',
  run(ctx) {
    if (!ctx.project) return [];
    const findings: Finding[] = [];
    const writers = writerSet(ctx.project);
    const reported = new Set<string>();
    for (const [name, progs] of writers) {
      if (progs.size <= 1) continue;
      const g = ctx.project.globals.get(name);
      if (!g) continue;
      const k = `${g.file}::${g.name.toLowerCase()}`;
      if (reported.has(k)) continue;
      reported.add(k);
      const progList = [...progs].sort().join(', ');
      findings.push({
        severity: 'error',
        category: 'MULTI_WRITER_GLOBAL',
        file: g.file,
        line: g.line,
        summary: `Global '${g.name}' is written by ${progs.size} PROGRAMs: ${progList} (PLCopen CP26)`,
        detail:
          'PLCopen CP26: a global variable shall be written by at most one PROGRAM. Multiple PROGRAMs writing to the same global is a classic concurrency hazard on PLC runtimes (tasks interleave; last-writer-wins behaviour is scan-order dependent). Designate one PROGRAM as the owner and have the others read or use a different mechanism (FB instance, separate global per writer).',
      });
    }
    return findings;
  },
};
