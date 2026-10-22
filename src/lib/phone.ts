/**
 * Normalizes a Bangladesh mobile number to E.164 (+8801XXXXXXXXX).
 *
 * Accepts common local forms (01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX)
 * with optional spaces/dashes. Returns null when the input is not a valid
 * BD mobile number.
 */
export function normalizeBdPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  let normalized = digits;

  if (/^01\d{9}$/.test(digits)) {
    normalized = `+880${digits.slice(1)}`;
  } else if (/^8801\d{9}$/.test(digits)) {
    normalized = `+${digits}`;
  } else if (/^\+8801\d{9}$/.test(digits)) {
    normalized = digits;
  } else {
    return null;
  }

  return /^\+8801\d{9}$/.test(normalized) ? normalized : null;
}
