import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config.js';

describe('resolveConfig', () => {
  it('applies disabled checks and severity overrides', () => {
    const cfg = resolveConfig({
      disabled_checks: ['COMMENT_ONLY'],
      severity_overrides: { TIMER_VALUE_CHANGED: 'error' },
      ignore_paths: ['deprecated/**'],
      safety_critical_prefixes: ['SAFETY_'],
      reporting: { fail_on_severity: 'warn', comment_style: 'summary' },
    });
    expect(cfg.disabledChecks.has('COMMENT_ONLY')).toBe(true);
    expect(cfg.severityOverrides.get('TIMER_VALUE_CHANGED')).toBe('error');
    expect(cfg.ignorePaths).toEqual(['deprecated/**']);
    expect(cfg.safetyCriticalPrefixes).toEqual(['SAFETY_']);
    expect(cfg.failOnSeverity).toBe('warn');
    expect(cfg.commentStyle).toBe('summary');
  });

  it('ignores unknown categories and severities', () => {
    const cfg = resolveConfig({
      disabled_checks: ['NONSENSE'],
      severity_overrides: { TIMER_VALUE_CHANGED: 'gibberish' },
    });
    expect(cfg.disabledChecks.size).toBe(0);
    expect(cfg.severityOverrides.size).toBe(0);
  });
});
