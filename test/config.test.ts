import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('ReDoS guard (S3)', () => {
    let stderr: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => {
      stderr.mockRestore();
    });

    it('drops an unsafe naming_conventions pattern and keeps a safe sibling rule', () => {
      const cfg = resolveConfig({
        naming_conventions: {
          fb_instance: { prefix: 'fb' },
          bool: { pattern: '(a+)+' },
        },
      });
      expect(cfg.namingConventions.fb_instance?.prefix).toBe('fb');
      expect(cfg.namingConventions.bool?.pattern).toBeUndefined();
      expect(stderr).toHaveBeenCalled();
    });

    it('drops a slash-wrapped unsafe regex from forbidden_symbols but keeps literals', () => {
      const cfg = resolveConfig({
        forbidden_symbols: ['DEBUG_MODE', '/(\\w+)+/', '/^safe$/'],
      });
      // The literal and the safe slash-wrapped regex stay; the unsafe one drops.
      expect(cfg.forbiddenSymbols).toEqual(['DEBUG_MODE', '/^safe$/']);
      expect(stderr).toHaveBeenCalled();
    });

    it('drops a slash-wrapped unsafe regex from naming_ignore', () => {
      const cfg = resolveConfig({
        naming_ignore: ['legacy_*', '/(a*)*/'],
      });
      expect(cfg.namingIgnore).toEqual(['legacy_*']);
      expect(stderr).toHaveBeenCalled();
    });
  });
});
