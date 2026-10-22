import { describe, it, expect } from 'vitest';
import { assertMinor, sumMinor, lineAmount, roundHalfUp, percentageOf, formatBdt } from './money';

describe('money', () => {
  it('rejects non-integer and negative amounts', () => {
    expect(() => assertMinor(10.5)).toThrow();
    expect(() => assertMinor(-1)).toThrow();
  });

  it('sums minor amounts', () => {
    expect(sumMinor([100, 250, 50])).toBe(400);
  });

  it('computes line amounts for integer unit price and quantity', () => {
    expect(lineAmount(10050, 3)).toBe(30150);
    expect(() => lineAmount(100, 0)).toThrow();
    expect(() => lineAmount(100, 1.5)).toThrow();
  });

  it('rounds half away from zero', () => {
    expect(roundHalfUp(10.5)).toBe(11);
    expect(roundHalfUp(10.4)).toBe(10);
  });

  it('computes percentage in basis points with rounding', () => {
    // 5% VAT on 10050 poisha = 502.5 -> 503
    expect(percentageOf(10050, 500)).toBe(503);
    expect(percentageOf(10000, 0)).toBe(0);
  });

  it('formats BDT minor units', () => {
    expect(formatBdt(10050)).toBe('৳100.50');
    expect(formatBdt(5)).toBe('৳0.05');
  });
});
