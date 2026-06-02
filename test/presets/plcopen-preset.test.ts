import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

// Loads `presets/plcopen.yml` through the real config loader, the same way a
// user's `.plc-st-review.yml` would when it does `extends: ./presets/plcopen.yml`.
// Guards the preset against accidental drift: malformed YAML, unknown keys,
// unknown naming dimensions, or dropped severity overrides would all surface
// here.

const presetPath = resolve(__dirname, '..', '..', 'presets', 'plcopen.yml');

describe('presets/plcopen.yml', () => {
  it('loads cleanly through loadConfig', async () => {
    const cfg = await loadConfig(presetPath);
    expect(cfg).toBeTruthy();
  });

  it('applies CP9 — tightens cyclomatic complexity and nesting thresholds', async () => {
    const cfg = await loadConfig(presetPath);
    expect(cfg.metricsThresholds.cyclomaticComplexity.warn).toBe(10);
    expect(cfg.metricsThresholds.cyclomaticComplexity.error).toBe(20);
    expect(cfg.metricsThresholds.nestingDepth.warn).toBe(4);
    expect(cfg.metricsThresholds.nestingDepth.error).toBe(6);
  });

  it('applies CP13 / CP20 — recursion (direct + indirect) and double-call to error', async () => {
    const cfg = await loadConfig(presetPath);
    expect(cfg.severityOverrides.get('RECURSIVE_CALL')).toBe('error');
    expect(cfg.severityOverrides.get('INDIRECT_RECURSIVE_CALL')).toBe('error');
    expect(cfg.severityOverrides.get('FB_INSTANCE_DOUBLE_CALL')).toBe('error');
  });

  it('enables the new PLCopen checks at warn (or info)', async () => {
    const cfg = await loadConfig(presetPath);
    for (const cat of [
      'DIRECT_ADDRESS_USED',       // N1 / CP1
      'IF_WITHOUT_ELSE',           // L17
      'FORBIDDEN_STATEMENT',       // L10
      'FOR_LOOP_VAR_MODIFIED',     // L12
      'NAME_REUSED_DIFFERENT_KIND',// N9
      'POINTER_ARITHMETIC',        // E2
      'POINTER_COMPARED',          // E3
      'TOO_MANY_PARAMETERS',       // CP23
      'TOO_MANY_GLOBALS_USED',     // CP18
    ] as const) {
      expect(cfg.severityOverrides.get(cat), cat).toBe('warn');
    }
    expect(cfg.severityOverrides.get('POU_NOT_COMMENTED')).toBe('info');
    expect(cfg.severityOverrides.get('IDENTIFIER_TOO_LONG')).toBe('info');
    expect(cfg.severityOverrides.get('FOR_LOOP_VAR_USED_AFTER')).toBe('info');
  });

  it('sets the numeric caps for N6 / CP18 / CP23', async () => {
    const cfg = await loadConfig(presetPath);
    expect(cfg.limits.maxIdentifierLength).toBe(32);
    expect(cfg.limits.maxGlobalsUsedPerPou).toBe(10);
    expect(cfg.limits.maxParameters).toBe(8);
  });

  it('applies C3 / C4 / CP8 / CP14 / CP24 / N5 — warn-level rules', async () => {
    const cfg = await loadConfig(presetPath);
    for (const cat of [
      'NESTED_COMMENTS',         // C3
      'COMMENTED_OUT_CODE',      // C4
      'REAL_EQUALITY',           // CP8
      'MULTIPLE_EXIT_POINTS',    // CP14
      'UNUSED_VAR_INTRODUCED',   // CP24
      'UNUSED_INPUT_VAR',        // CP24
      'UNUSED_OUTPUT_VAR',       // CP24
      'VARIABLE_SHADOWING',      // N5
    ] as const) {
      expect(cfg.severityOverrides.get(cat), cat).toBe('warn');
    }
  });

  it('applies N2 / N10 — type prefixes for variables and user-defined types', async () => {
    const cfg = await loadConfig(presetPath);
    expect(cfg.namingConventions.bool?.prefix).toBe('x');
    expect(cfg.namingConventions.int?.prefix).toBe('i');
    expect(cfg.namingConventions.real?.prefix).toBe('r');
    expect(cfg.namingConventions.string?.prefix).toBe('s');
    expect(cfg.namingConventions.enum_type?.prefix).toBe('E_');
    expect(cfg.namingConventions.structure_type?.prefix).toBe('ST_');
    expect(cfg.namingConventions.function_block?.prefix).toBe('FB_');
    expect(cfg.namingConventions.fb_instance?.prefix).toBe('fb');
  });

  it('applies N4 — constants in UPPER_CASE', async () => {
    const cfg = await loadConfig(presetPath);
    expect(cfg.namingConventions.constant?.pattern).toBe('^[A-Z][A-Z0-9_]+$');
  });
});
