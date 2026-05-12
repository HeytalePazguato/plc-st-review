import type { AstFile, FilePair, Parameter } from './types.js';

export function pairFiles(
  beforeFiles: AstFile[],
  afterFiles: AstFile[],
): FilePair[] {
  const byPath = new Map<string, FilePair>();
  for (const f of beforeFiles) {
    byPath.set(f.path, { path: f.path, before: f, after: null });
  }
  for (const f of afterFiles) {
    const existing = byPath.get(f.path);
    if (existing) {
      existing.after = f;
    } else {
      byPath.set(f.path, { path: f.path, before: null, after: f });
    }
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function signatureKey(params: readonly Parameter[]): string {
  return params
    .map((p) => `${p.name}:${normalizeType(p.typeText)}`)
    .join('|');
}

export function paramByName(
  params: readonly Parameter[],
  name: string,
): Parameter | undefined {
  for (const p of params) {
    if (p.name.toLowerCase() === name.toLowerCase()) return p;
  }
  return undefined;
}

export function normalizeType(typeText: string): string {
  return typeText.replace(/\s+/g, ' ').trim().toUpperCase();
}

export function normalizeTimeLiteral(text: string): number | null {
  const trimmed = text.trim().replace(/^TIME#/i, '').replace(/^T#/i, '');
  const re =
    /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+)s)?(?:(\d+)ms)?(?:(\d+)us)?(?:(\d+)ns)?$/i;
  const m = re.exec(trimmed);
  if (!m) return null;
  const [, d, h, mins, s, ms, us, ns] = m;
  if (!d && !h && !mins && !s && !ms && !us && !ns) return null;
  let total = 0;
  total += parseInt(d ?? '0', 10) * 86_400_000;
  total += parseInt(h ?? '0', 10) * 3_600_000;
  total += parseInt(mins ?? '0', 10) * 60_000;
  total += parseInt(s ?? '0', 10) * 1_000;
  total += parseInt(ms ?? '0', 10);
  total += parseInt(us ?? '0', 10) / 1_000;
  total += parseInt(ns ?? '0', 10) / 1_000_000;
  return total;
}

export interface ParamDelta {
  added: Parameter[];
  removed: Parameter[];
  typeChanged: Array<{ name: string; before: Parameter; after: Parameter }>;
  initialChanged: Array<{ name: string; before: Parameter; after: Parameter }>;
}

export function diffParams(
  before: readonly Parameter[],
  after: readonly Parameter[],
): ParamDelta {
  const delta: ParamDelta = {
    added: [],
    removed: [],
    typeChanged: [],
    initialChanged: [],
  };
  const afterByName = new Map<string, Parameter>();
  for (const p of after) afterByName.set(p.name.toLowerCase(), p);
  const beforeByName = new Map<string, Parameter>();
  for (const p of before) beforeByName.set(p.name.toLowerCase(), p);

  for (const a of after) {
    const b = beforeByName.get(a.name.toLowerCase());
    if (!b) {
      delta.added.push(a);
      continue;
    }
    if (normalizeType(b.typeText) !== normalizeType(a.typeText)) {
      delta.typeChanged.push({ name: a.name, before: b, after: a });
    }
    if ((b.initial ?? '') !== (a.initial ?? '')) {
      delta.initialChanged.push({ name: a.name, before: b, after: a });
    }
  }
  for (const b of before) {
    if (!afterByName.has(b.name.toLowerCase())) delta.removed.push(b);
  }
  return delta;
}
