import type { Check, Finding } from '../types.js';

export const constantValueChanged: Check = {
  category: 'CONSTANT_VALUE_CHANGED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const prefixes = ctx.config.safetyCriticalPrefixes.map((p) => p.toLowerCase());
    for (const [name, after] of ctx.after.globals) {
      if (!after.constant) continue;
      const before = ctx.before.globals.get(name);
      if (!before || !before.constant) continue;
      if ((before.initial ?? '') === (after.initial ?? '')) continue;
      const isCritical = prefixes.some((p) => name.toLowerCase().startsWith(p));
      findings.push({
        severity: isCritical ? 'warn' : 'info',
        category: 'CONSTANT_VALUE_CHANGED',
        file: after.file,
        line: after.line,
        summary: `Constant ${name}: ${before.initial ?? '<unset>'} → ${after.initial ?? '<unset>'}`,
        detail: isCritical
          ? `Identifier prefix matches a safety-critical pattern; double-check the change is approved.`
          : undefined,
      });
    }
    return findings;
  },
};
