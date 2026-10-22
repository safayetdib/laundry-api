import { describe, it, expect } from 'vitest';
import { normalizeBdPhone } from './phone';

describe('normalizeBdPhone', () => {
  it('normalizes local 01X numbers to E.164', () => {
    expect(normalizeBdPhone('01712345678')).toBe('+8801712345678');
  });

  it('accepts spaces and dashes', () => {
    expect(normalizeBdPhone('017-1234 5678')).toBe('+8801712345678');
  });

  it('accepts 880 and +880 prefixes', () => {
    expect(normalizeBdPhone('8801712345678')).toBe('+8801712345678');
    expect(normalizeBdPhone('+8801712345678')).toBe('+8801712345678');
  });

  it('rejects invalid numbers', () => {
    expect(normalizeBdPhone('12345')).toBeNull();
    expect(normalizeBdPhone('+1 415 555 0100')).toBeNull();
    expect(normalizeBdPhone('0171234567')).toBeNull(); // too short
  });
});
