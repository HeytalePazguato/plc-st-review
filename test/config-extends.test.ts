import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../src/config.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'plcconfig-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(name: string, body: string): string {
  const p = join(dir, name);
  writeFileSync(p, body, 'utf8');
  return p;
}

describe('config extends', () => {
  it('merges a single preset with the local file (local wins)', async () => {
    write(
      'base.yml',
      [
        'disabled_checks:',
        '  - COMMENT_ONLY',
        'severity_overrides:',
        '  TIMER_VALUE_CHANGED: warn',
      ].join('\n'),
    );
    const local = write(
      'project.yml',
      [
        'extends: ./base.yml',
        'severity_overrides:',
        '  TIMER_VALUE_CHANGED: error',
      ].join('\n'),
    );
    const cfg = await loadConfig(local);
    expect(cfg.disabledChecks.has('COMMENT_ONLY')).toBe(true);
    expect(cfg.severityOverrides.get('TIMER_VALUE_CHANGED')).toBe('error');
  });

  it('applies multiple presets in order, later wins', async () => {
    write('a.yml', 'severity_overrides:\n  TIMER_VALUE_CHANGED: info\n');
    write('b.yml', 'severity_overrides:\n  TIMER_VALUE_CHANGED: warn\n');
    const local = write(
      'project.yml',
      ['extends:', '  - ./a.yml', '  - ./b.yml'].join('\n'),
    );
    const cfg = await loadConfig(local);
    expect(cfg.severityOverrides.get('TIMER_VALUE_CHANGED')).toBe('warn');
  });

  it('detects cyclic extends', async () => {
    const a = write('a.yml', 'extends: ./b.yml\n');
    write('b.yml', 'extends: ./a.yml\n');
    await expect(loadConfig(a)).rejects.toThrow(/cycle/);
  });

  it('parses naming_conventions blocks', async () => {
    const local = write(
      'project.yml',
      [
        'naming_conventions:',
        '  function_block:',
        '    prefix: FB_',
        '    severity: warn',
        '  enum_type:',
        '    suffix: _enum',
        '    case: insensitive',
      ].join('\n'),
    );
    const cfg = await loadConfig(local);
    expect(cfg.namingConventions.function_block?.prefix).toBe('FB_');
    expect(cfg.namingConventions.function_block?.severity).toBe('warn');
    expect(cfg.namingConventions.enum_type?.suffix).toBe('_enum');
    expect(cfg.namingConventions.enum_type?.case).toBe('insensitive');
  });
});
