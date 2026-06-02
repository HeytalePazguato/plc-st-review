import type { AssignmentTarget, Check, Finding, SymbolTable } from '../types.js';

// PLCopen CP25 — data-type conversions shall be explicit.
//
// Tractable subset: catch the most common case — an assignment whose LHS is
// declared as one numeric "family" (INT-like vs REAL-like) and whose RHS
// resolves to the other family. Full type inference is out of scope; the
// check uses the LHS declared type and the RHS textual shape (literal kind +
// identifier-type lookup).

const INT_TYPES = new Set<string>([
  'SINT', 'INT', 'DINT', 'LINT',
  'USINT', 'UINT', 'UDINT', 'ULINT',
  'BYTE', 'WORD', 'DWORD', 'LWORD',
]);
const REAL_TYPES = new Set<string>(['REAL', 'LREAL']);

type Family = 'int' | 'real' | 'unknown';

function familyOfTypeText(t: string | undefined): Family {
  const u = (t ?? '').trim().toUpperCase();
  if (INT_TYPES.has(u)) return 'int';
  if (REAL_TYPES.has(u)) return 'real';
  return 'unknown';
}

function familyOfLiteral(raw: string): Family {
  const t = raw.trim();
  if (/^[+-]?\d+\.\d/.test(t)) return 'real';                       // 3.14
  if (/^[+-]?\d+([eE][+-]?\d+)/.test(t)) return 'real';            // 1e6
  if (/^L?REAL#/i.test(t)) return 'real';                          // REAL#1.0
  if (/^[+-]?\d+$/.test(t)) return 'int';                          // 42
  if (/^[+-]?\d+_\d/.test(t)) return 'int';                        // 1_000
  if (/^(2|8|16)#/.test(t)) return 'int';                          // 16#FF
  if (/^(S?INT|U?(D|L)?INT|BYTE|WORD|DWORD|LWORD)#/i.test(t)) return 'int';
  return 'unknown';
}

function familyOfIdentifier(name: string, t: SymbolTable): Family {
  const lower = name.toLowerCase();
  // Globals first (CaseMap lookup handles dialect).
  const g = t.globals.get(name);
  if (g) return familyOfTypeText(g.typeText);
  // Then any declared variable with that name.
  for (const d of t.declarations) {
    if (d.name.toLowerCase() === lower) {
      const f = familyOfTypeText(d.typeText);
      if (f !== 'unknown') return f;
    }
  }
  return 'unknown';
}

function rhsFamily(rhsText: string, t: SymbolTable): Family {
  const r = rhsText.trim();
  // Bare identifier — resolve.
  const idMatch = /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(r);
  if (idMatch) return familyOfIdentifier(idMatch[1], t);
  // Literal.
  const lit = familyOfLiteral(r);
  if (lit !== 'unknown') return lit;
  return 'unknown';
}

function lhsFamily(assign: AssignmentTarget, t: SymbolTable): Family {
  // Use the first identifier in the LHS as the lookup name.
  const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(assign.name.trim() || assign.rawText.trim());
  if (!m) return 'unknown';
  return familyOfIdentifier(m[1], t);
}

function assignKey(a: AssignmentTarget): string {
  return `${a.file}::${a.line}::${a.rawText}`;
}

function rhsOfAssign(_a: AssignmentTarget): string {
  // assignmentTargets currently carry the LHS only. Without per-target RHS
  // text we can't classify the RHS family from the assignment record. Bail.
  return '';
}

interface Mismatch {
  file: string;
  line: number;
  lhsFamily: Family;
  rhsText: string;
  rhsFamily: Family;
  rawText: string;
}

function findMismatches(t: SymbolTable): Mismatch[] {
  // Use binary expressions whose operator-shape is assignment-like (`:=`).
  // The grammar models `x := y` as `assignment_statement`, not as a binary
  // expression; the rhs text is on the assignment node, which we don't
  // currently store in t. Fall back to a more limited heuristic: look at
  // every BinaryExpression with arithmetic operators where one operand is
  // an INT-family identifier/literal and the other a REAL-family one. That
  // catches the common "int / real" / "real := int_var + real_lit" cases
  // without needing the assignment RHS.
  const out: Mismatch[] = [];
  for (const b of t.binaryExpressions) {
    if (!/^[+\-*/]$/.test(b.op)) continue;
    const leftFam = familyOfLiteral(b.leftText) !== 'unknown'
      ? familyOfLiteral(b.leftText)
      : familyOfIdentifier(firstWord(b.leftText), t);
    const rightFam = familyOfLiteral(b.rightText) !== 'unknown'
      ? familyOfLiteral(b.rightText)
      : familyOfIdentifier(firstWord(b.rightText), t);
    if (leftFam === 'unknown' || rightFam === 'unknown') continue;
    if (leftFam === rightFam) continue;
    out.push({
      file: b.file,
      line: b.line,
      lhsFamily: leftFam,
      rhsFamily: rightFam,
      rhsText: b.rightText,
      rawText: `${b.leftText} ${b.op} ${b.rightText}`,
    });
  }
  return out;
}

function firstWord(text: string): string {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(text.trim());
  return m?.[1] ?? '';
}

function mismatchKey(m: Mismatch): string {
  return `${m.file}::${m.line}::${m.rawText}`;
}

// Suppress unused-helper warnings — both are reserved for the
// assignment-RHS-aware version of this check (out of scope for v1).
void assignKey;
void rhsOfAssign;
void rhsFamily;
void lhsFamily;

export const implicitTypeConversion: Check = {
  category: 'IMPLICIT_TYPE_CONVERSION',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(findMismatches(ctx.before).map(mismatchKey));
    for (const m of findMismatches(ctx.after)) {
      if (before.has(mismatchKey(m))) continue;
      findings.push({
        severity: 'info',
        category: 'IMPLICIT_TYPE_CONVERSION',
        file: m.file,
        line: m.line,
        summary: `Implicit type conversion in '${m.rawText}' (mixing ${m.lhsFamily.toUpperCase()} and ${m.rhsFamily.toUpperCase()}) — PLCopen CP25`,
        detail:
          'PLCopen CP25: mixing integer and real operands in arithmetic forces an implicit type conversion. Make the intent explicit with an INT_TO_REAL / REAL_TO_INT (or similar) cast, or use operands of the same type family.',
      });
    }
    return findings;
  },
};
