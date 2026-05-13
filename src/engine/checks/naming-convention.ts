import type {
  Check,
  Finding,
  NamedDecl,
  NamingDimension,
  NamingRule,
  ResolvedConfig,
  Severity,
} from '../types.js';

const BASIC_TYPE_DIMENSIONS: Record<string, NamingDimension> = {
  BOOL: 'bool',
  INT: 'int',
  SINT: 'int',
  DINT: 'int',
  LINT: 'int',
  USINT: 'int',
  UINT: 'int',
  UDINT: 'int',
  ULINT: 'int',
  WORD: 'int',
  DWORD: 'int',
  LWORD: 'int',
  BYTE: 'int',
  REAL: 'real',
  LREAL: 'real',
  STRING: 'string',
  WSTRING: 'string',
  TIME: 'time',
  LTIME: 'time',
  DATE: 'time',
  TIME_OF_DAY: 'time',
  DATE_AND_TIME: 'time',
};

function dimensionFor(decl: NamedDecl): NamingDimension | null {
  switch (decl.kind) {
    case 'program':
      return 'program';
    case 'function':
      return 'function';
    case 'function_block':
      return 'function_block';
    case 'method':
      return 'method';
    case 'interface':
      return 'interface';
    case 'enum_type':
      return 'enum_type';
    case 'structure_type':
      return 'structure_type';
    case 'array_type':
      return 'array';
    case 'constant':
      return 'constant';
    case 'var_global':
      return 'global_var';
    case 'var_input':
      return 'input_var';
    case 'var_output':
      return 'output_var';
    case 'var_in_out':
      return 'in_out_var';
    case 'fb_instance':
    case 'timer_instance':
    case 'counter_instance':
    case 'edge_trig_instance':
    case 'bistable_instance':
      return 'fb_instance';
    case 'var_local':
    case 'var_temp': {
      const t = (decl.typeText ?? '').trim().toUpperCase();
      return BASIC_TYPE_DIMENSIONS[t] ?? null;
    }
    default:
      return null;
  }
}

function ignored(name: string, patterns: readonly string[]): boolean {
  for (const p of patterns) {
    if (p.startsWith('/') && p.endsWith('/')) {
      try {
        const re = new RegExp(p.slice(1, -1));
        if (re.test(name)) return true;
      } catch {
        // ignore malformed
      }
    } else if (p === name) {
      return true;
    }
  }
  return false;
}

function violates(name: string, rule: NamingRule): string | null {
  const cmp = rule.case === 'insensitive'
    ? (a: string, b: string) => a.toLowerCase().startsWith(b.toLowerCase())
    : (a: string, b: string) => a.startsWith(b);
  const cmpEnd = rule.case === 'insensitive'
    ? (a: string, b: string) => a.toLowerCase().endsWith(b.toLowerCase())
    : (a: string, b: string) => a.endsWith(b);
  if (rule.prefix && !cmp(name, rule.prefix)) {
    return `does not start with '${rule.prefix}'`;
  }
  if (rule.suffix && !cmpEnd(name, rule.suffix)) {
    return `does not end with '${rule.suffix}'`;
  }
  if (rule.pattern) {
    try {
      const re = new RegExp(rule.pattern);
      if (!re.test(name)) return `does not match /${rule.pattern}/`;
    } catch {
      // malformed pattern silently skipped
    }
  }
  return null;
}

function ruleSeverity(rule: NamingRule, cfg: ResolvedConfig): Severity {
  if (rule.severity) return rule.severity;
  return cfg.severityOverrides.get('NAMING_CONVENTION') ?? 'warn';
}

function key(d: NamedDecl): string {
  return `${d.file}::${d.scope}::${d.kind}::${d.name}`;
}

export const namingConvention: Check = {
  category: 'NAMING_CONVENTION',
  defaultSeverity: 'warn',
  run(ctx) {
    const cfg = ctx.config;
    const rules = cfg.namingConventions;
    if (Object.keys(rules).length === 0) return [];
    const findings: Finding[] = [];

    const evaluate = (decls: readonly NamedDecl[]): Map<string, { d: NamedDecl; reason: string; sev: Severity }> => {
      const out = new Map<string, { d: NamedDecl; reason: string; sev: Severity }>();
      for (const d of decls) {
        if (ignored(d.name, cfg.namingIgnore)) continue;
        const dim = dimensionFor(d);
        if (!dim) continue;
        const rule = rules[dim];
        if (!rule) continue;
        const reason = violates(d.name, rule);
        if (!reason) continue;
        out.set(key(d), { d, reason, sev: ruleSeverity(rule, cfg) });
      }
      return out;
    };

    const beforeBad = evaluate(ctx.before.declarations);
    const afterBad = evaluate(ctx.after.declarations);

    for (const [k, { d, reason, sev }] of afterBad) {
      if (beforeBad.has(k)) continue;
      findings.push({
        severity: sev,
        category: 'NAMING_CONVENTION',
        file: d.file,
        line: d.line,
        summary: `${d.kind} '${d.name}' ${reason} (naming convention)`,
        detail:
          'Naming-convention rule failed for this declaration. Tune the rule under `naming_conventions:` in your `.plc-st-review.yml`, or add the identifier to `naming_ignore:` if it is grandfathered in.',
      });
    }
    return findings;
  },
};
