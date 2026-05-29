import { describe, expect, it } from 'vitest';
import { parseStNumber } from '../../src/engine/literals.js';

describe('parseStNumber', () => {
  it('parses plain decimals and reals, signed', () => {
    expect(parseStNumber('0')).toBe(0);
    expect(parseStNumber('42')).toBe(42);
    expect(parseStNumber('-7')).toBe(-7);
    expect(parseStNumber('+5')).toBe(5);
    expect(parseStNumber('3.14')).toBe(3.14);
    expect(parseStNumber('1.0e3')).toBe(1000);
    expect(parseStNumber('  12  ')).toBe(12);
  });

  it('parses digit-group separators', () => {
    expect(parseStNumber('1_000')).toBe(1000);
    expect(parseStNumber('1_000_000')).toBe(1_000_000);
    expect(parseStNumber('16#FF_FF')).toBe(65535);
  });

  it('parses based (radix) literals', () => {
    expect(parseStNumber('2#1010')).toBe(10);
    expect(parseStNumber('8#17')).toBe(15);
    expect(parseStNumber('16#FF')).toBe(255);
    expect(parseStNumber('16#ff')).toBe(255);
    expect(parseStNumber('16#0')).toBe(0);
    expect(parseStNumber('2#10000')).toBe(16);
    expect(parseStNumber('-16#10')).toBe(-16);
  });

  it('parses typed literals by stripping the type prefix', () => {
    expect(parseStNumber('INT#42')).toBe(42);
    expect(parseStNumber('UINT#16#FF')).toBe(255);
    expect(parseStNumber('WORD#16#A0')).toBe(160);
    expect(parseStNumber('-INT#5')).toBe(-5);
  });

  it('rejects non-numeric and malformed literals', () => {
    expect(parseStNumber('')).toBeNull();
    expect(parseStNumber('i')).toBeNull();
    expect(parseStNumber('TRUE')).toBeNull();
    expect(parseStNumber('T#5s')).toBeNull();
    expect(parseStNumber('16#')).toBeNull();
    expect(parseStNumber('#FF')).toBeNull();
    expect(parseStNumber('2#1210')).toBeNull(); // 2 is not a binary digit
    expect(parseStNumber('16#GG')).toBeNull();
    expect(parseStNumber('i + 1')).toBeNull();
  });
});
