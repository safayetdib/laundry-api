/**
 * Money is always integer minor units (BDT poisha). ৳100.50 == 10050.
 * Never use floating-point for stored amounts; these helpers keep arithmetic
 * in integers and apply an explicit rounding rule for percentage math.
 */
export const CURRENCY = 'BDT';

export function assertMinor(amount: number, label = 'amount'): void {
  if (!Number.isInteger(amount)) {
    throw new Error(`${label} must be an integer minor-unit value, got ${amount}`);
  }
  if (amount < 0) {
    throw new Error(`${label} must not be negative, got ${amount}`);
  }
}

/** Sum of minor-unit amounts. */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((total, amount) => {
    assertMinor(amount);
    return total + amount;
  }, 0);
}

/** Line amount for an integer unit price and integer quantity. */
export function lineAmount(unitAmount: number, quantity: number): number {
  assertMinor(unitAmount, 'unitAmount');
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`quantity must be a positive integer, got ${quantity}`);
  }
  return unitAmount * quantity;
}

/** Rounds to the nearest minor unit, half away from zero. */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Percentage of an amount expressed in basis points (1% = 100 bps). */
export function percentageOf(amount: number, basisPoints: number): number {
  assertMinor(amount);
  if (!Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new Error(`basisPoints must be a non-negative integer, got ${basisPoints}`);
  }
  return roundHalfUp((amount * basisPoints) / 10_000);
}

/** Formats minor units as a display string (e.g. 10050 -> "৳100.50"). */
export function formatBdt(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const taka = Math.floor(abs / 100);
  const poisha = String(abs % 100).padStart(2, '0');
  return `${sign}৳${taka}.${poisha}`;
}
