import { describe, expect, it } from '@jest/globals';
import { parsePort } from '../parsePort';

describe('parsePort', () => {
  it('uses 3000 when PORT is unset or empty', () => {
    expect(parsePort(undefined)).toBe(3000);
    expect(parsePort('')).toBe(3000);
  });

  it('returns a whole number from 1 to 65535', () => {
    expect(parsePort('1')).toBe(1);
    expect(parsePort('3000')).toBe(3000);
    expect(parsePort('65535')).toBe(65535);
  });

  it.each(['abc', '3000x', '0', '70000', '3.5'])('rejects %s', (port) => {
    expect(() => parsePort(port)).toThrow(RangeError);
    expect(() => parsePort(port)).toThrow(
      `Expected PORT to be a whole number from 1 to 65535, got ${port}`,
    );
  });
});
