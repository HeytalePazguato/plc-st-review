import { describe, expect, it } from 'vitest';
import { isUnsafePattern } from '../../src/engine/regex-guard.js';

describe('isUnsafePattern', () => {
  it('accepts ordinary identifier-shaped patterns', () => {
    expect(isUnsafePattern('^[A-Z][a-zA-Z0-9_]*$')).toBe(false);
    expect(isUnsafePattern('^iVar_.*$')).toBe(false);
    expect(isUnsafePattern('^x[A-Z][a-zA-Z0-9_]*$')).toBe(false);
    expect(isUnsafePattern('^(input|output|inOut)_.*$')).toBe(false);
    expect(isUnsafePattern('^(?:input|output)_[A-Z].*$')).toBe(false);
    expect(isUnsafePattern('^[a-z][a-zA-Z0-9_]{0,30}$')).toBe(false);
  });

  it('rejects classic catastrophic-backtracking shapes', () => {
    expect(isUnsafePattern('(a+)+')).toBe(true);
    expect(isUnsafePattern('(a*)*')).toBe(true);
    expect(isUnsafePattern('(a+)*')).toBe(true);
    expect(isUnsafePattern('(\\w+)+')).toBe(true);
    expect(isUnsafePattern('(.*x)+')).toBe(true);
    expect(isUnsafePattern('^(.+)*$')).toBe(true);
  });

  it('rejects nested quantifiers inside non-capturing groups', () => {
    expect(isUnsafePattern('(?:a+)+')).toBe(true);
    expect(isUnsafePattern('(?:\\d+)*')).toBe(true);
  });

  it('treats bounded `{m,n}` with small upper as safe', () => {
    expect(isUnsafePattern('([0-9]{1,5})+')).toBe(false);
    // But `{m,}` (open-ended) and very large upper bound are quantifier-ish.
    expect(isUnsafePattern('([0-9]{1,})+')).toBe(true);
    expect(isUnsafePattern('([0-9]{1,500})+')).toBe(true);
  });

  it('treats `(...)?` as bounded — not a ReDoS shape', () => {
    expect(isUnsafePattern('(a+)?')).toBe(false);
    expect(isUnsafePattern('(\\w+)?')).toBe(false);
  });

  it('rejects patterns over the length cap', () => {
    expect(isUnsafePattern('a'.repeat(201))).toBe(true);
    expect(isUnsafePattern('a'.repeat(200))).toBe(false);
  });

  it('does not false-positive on literal `+`/`*` in character classes or escapes', () => {
    expect(isUnsafePattern('^[+*]$')).toBe(false);
    expect(isUnsafePattern('\\+\\*')).toBe(false);
  });
});
