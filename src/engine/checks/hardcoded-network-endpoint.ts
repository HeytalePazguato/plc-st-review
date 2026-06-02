import type { Check, Finding, GlobalVar, LocalVar } from '../types.js';

// IEC 62443-4-1 SI-1: configuration data (incl. network endpoints) should not
// be hard-coded into the component. A literal IP / URL in source code makes
// the component non-portable across deployments and forces a code change to
// migrate between dev / staging / production environments — exactly the kind
// of risk that triggers a CVE write-up when a "test" endpoint reaches prod.

// Strict IPv4 dotted-quad: each octet 0-255, anchored.
const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)(?::\d+)?$/;

// Common ICS / OT URL schemes plus general http(s).
const URL_RE =
  /^(https?|ftp|tcp|udp|opc|opc\.tcp|opc\.https?|mqtt|mqtts|modbus|ssh):\/\//i;

const STRING_TYPES = new Set<string>(['STRING', 'WSTRING']);

// Loopback / unspecified / link-local addresses that are *almost always*
// intentional placeholders, not real deployment targets. Skip them to keep
// signal-to-noise high; integrators who want them flagged can drop a rule
// into `forbidden_symbols` instead.
const ALLOWLIST = new Set<string>(['127.0.0.1', '0.0.0.0', 'localhost', '::1']);

function isStringType(typeText: string): boolean {
  const head = typeText.trim().toUpperCase().split(/[\s\[]/)[0];
  return STRING_TYPES.has(head);
}

function literalValue(initial: string | undefined): string | null {
  if (!initial) return null;
  const trimmed = initial.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return null;
}

function endpointKind(value: string): 'ip' | 'url' | null {
  if (ALLOWLIST.has(value.toLowerCase())) return null;
  if (IPV4_RE.test(value)) return 'ip';
  if (URL_RE.test(value)) return 'url';
  return null;
}

function flag(
  decl: GlobalVar | LocalVar,
): Finding | null {
  if (!isStringType(decl.typeText)) return null;
  const value = literalValue(decl.initial);
  if (value === null) return null;
  const kind = endpointKind(value);
  if (kind === null) return null;
  return {
    severity: 'warn',
    category: 'HARDCODED_NETWORK_ENDPOINT',
    file: decl.file,
    line: decl.line,
    summary: `Hard-coded network ${kind === 'ip' ? 'IP address' : 'URL'} in '${decl.name}' = '${value}' (IEC 62443-4-1 SI-1)`,
    detail:
      "IEC 62443-4-1 SI-1: configuration data should not be hard-coded. Hard-coded IPs and URLs make the component non-portable across deployments and tie production behaviour to whichever environment the developer happened to be testing against. Move the endpoint to a configuration store (e.g. a `VAR CONFIG` block populated by the engineering tool) or accept it as a `VAR_INPUT` so the integrator can override per-deployment.",
  };
}

export const hardcodedNetworkEndpoint: Check = {
  category: 'HARDCODED_NETWORK_ENDPOINT',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const seen = new Set<string>();
    for (const g of ctx.after.globalDecls) {
      const f = flag(g);
      if (!f) continue;
      const k = `${f.file}::${f.line}::${g.name.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      findings.push(f);
    }
    for (const locals of ctx.after.pouLocals.values()) {
      for (const l of locals) {
        const f = flag(l);
        if (!f) continue;
        const k = `${f.file}::${f.line}::${l.name.toLowerCase()}`;
        if (seen.has(k)) continue;
        seen.add(k);
        findings.push(f);
      }
    }
    return findings;
  },
};
