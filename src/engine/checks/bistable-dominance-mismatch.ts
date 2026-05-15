import type { BistableInstance, Check, Finding } from '../types.js';

// Naming hints that suggest the bistable should be reset-dominant (RS).
const RESET_DOMINANT_HINTS = ['estop', 'stop', 'trip', 'reset', 'fault', 'safety', 'lock'];
// Naming hints that suggest the bistable should be set-dominant (SR).
const SET_DOMINANT_HINTS = ['set', 'latch', 'enable', 'start', 'arm'];

function suggestedDominance(name: string): 'SR' | 'RS' | null {
  const lower = name.toLowerCase();
  if (RESET_DOMINANT_HINTS.some((h) => lower.includes(h))) return 'RS';
  if (SET_DOMINANT_HINTS.some((h) => lower.includes(h))) return 'SR';
  return null;
}

function key(b: BistableInstance): string {
  return `${b.file}::${b.scope}::${b.name}`;
}

export const bistableDominanceMismatch: Check = {
  category: 'BISTABLE_DOMINANCE_MISMATCH',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const b of ctx.before.bistableInstances) {
      const want = suggestedDominance(b.name);
      if (want && want !== b.bistableType) beforeBad.add(key(b));
    }
    for (const b of ctx.after.bistableInstances) {
      const want = suggestedDominance(b.name);
      if (!want || want === b.bistableType) continue;
      if (beforeBad.has(key(b))) continue;
      findings.push({
        severity: 'info',
        category: 'BISTABLE_DOMINANCE_MISMATCH',
        file: b.file,
        line: b.line,
        summary: `${b.name} is ${b.bistableType} but its name suggests ${want} (${b.bistableType === 'SR' ? 'set-dominant' : 'reset-dominant'} vs ${want === 'SR' ? 'set-dominant' : 'reset-dominant'})`,
        detail:
          'Heuristic check: variable name contains a hint about which input should win when both are TRUE. This is a naming convention guess, false positives are expected on shops that name otherwise. Disable via `disabled_checks: [BISTABLE_DOMINANCE_MISMATCH]` if not useful.',
      });
    }
    return findings;
  },
};
