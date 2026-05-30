import type { Check, DirectAddress, Finding } from '../types.js';

function key(d: DirectAddress): string {
  return `${d.file}::${d.line}::${d.text}`;
}

export const directAddressUsed: Check = {
  category: 'DIRECT_ADDRESS_USED',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(ctx.before.directAddresses.map(key));
    for (const d of ctx.after.directAddresses) {
      if (before.has(key(d))) continue;
      findings.push({
        severity: 'warn',
        category: 'DIRECT_ADDRESS_USED',
        file: d.file,
        line: d.line,
        summary: `Direct address ${d.text} used (PLCopen N1 / CP1)`,
        detail:
          'PLCopen N1 / CP1: access I/O and memory by symbolic name, not by physical address. Map the address to a named global (e.g. `xStartButton AT %IX0.0 : BOOL;`) and reference the name instead.',
      });
    }
    return findings;
  },
};
