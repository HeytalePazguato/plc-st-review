import { describe, expect, it } from 'vitest';
import { normalizeTimeLiteral } from '../../src/engine/diff.js';

describe('normalizeTimeLiteral', () => {
  it('parses simple values', () => {
    expect(normalizeTimeLiteral('T#5s')).toBe(5000);
    expect(normalizeTimeLiteral('T#500ms')).toBe(500);
    expect(normalizeTimeLiteral('TIME#1m')).toBe(60_000);
    expect(normalizeTimeLiteral('T#2h')).toBe(7_200_000);
  });

  it('parses compound values', () => {
    expect(normalizeTimeLiteral('T#1m30s')).toBe(90_000);
    expect(normalizeTimeLiteral('T#2h15m')).toBe(2 * 3_600_000 + 15 * 60_000);
  });

  it('returns null for non-time strings', () => {
    expect(normalizeTimeLiteral('FALSE')).toBeNull();
    expect(normalizeTimeLiteral('42')).toBeNull();
  });
});
