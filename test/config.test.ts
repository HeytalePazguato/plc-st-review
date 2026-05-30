import { describe, expect, it, vi } from 'vitest';
import {
  loadConfigFromBaseRef,
  loadConfigFromText,
  resolveConfig,
} from '../src/config.js';

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

  describe('loadConfigFromText', () => {
    it('parses a self-contained YAML config string', () => {
      const cfg = loadConfigFromText(`
disabled_checks:
  - COMMENT_ONLY
reporting:
  fail_on_severity: warn
`);
      expect(cfg.disabledChecks.has('COMMENT_ONLY')).toBe(true);
      expect(cfg.failOnSeverity).toBe('warn');
    });

    it('treats an empty string as the default config', () => {
      const cfg = loadConfigFromText('');
      expect(cfg.failOnSeverity).toBe('error');
    });
  });

  describe('loadConfigFromBaseRef (S3 base-ref loading)', () => {
    it('returns the config from the first matching base-ref filename', async () => {
      const fetcher = vi.fn(async (name: string) => {
        if (name === '.plc-st-review.yml') return 'reporting:\n  fail_on_severity: warn\n';
        return null;
      });
      const cfg = await loadConfigFromBaseRef(fetcher);
      expect(cfg).not.toBeNull();
      expect(cfg!.failOnSeverity).toBe('warn');
      expect(fetcher).toHaveBeenCalledWith('.plc-st-review.yml');
      // Second name should not be tried since the first hit.
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('falls back to the editor-friendly name when the dotfile is absent', async () => {
      const fetcher = vi.fn(async (name: string) =>
        name === 'plc-st-review.yml' ? 'reporting:\n  fail_on_severity: warn\n' : null,
      );
      const cfg = await loadConfigFromBaseRef(fetcher);
      expect(cfg).not.toBeNull();
      expect(cfg!.failOnSeverity).toBe('warn');
      expect(fetcher).toHaveBeenCalledWith('.plc-st-review.yml');
      expect(fetcher).toHaveBeenCalledWith('plc-st-review.yml');
    });

    it('returns null when neither filename exists at the base ref', async () => {
      const fetcher = vi.fn(async () => null);
      expect(await loadConfigFromBaseRef(fetcher)).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });
});
