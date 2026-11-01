/**
 * Pure money math helpers for HabitCircle.
 *
 * All monetary values are stored as integer minor units (e.g. paise for INR,
 * cents for USD). This module NEVER uses floats for money arithmetic.
 */

/** Map of ISO 4217 currency codes → display symbols. */
export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
} as const;

/** Number of minor units per major unit (always 100 for supported currencies). */
const MINOR_UNIT_FACTOR = 100;

/**
 * Format an integer amount of minor units into a human-readable string.
 *
 * @example formatMoney(10050, 'INR') // '₹100.50'
 * @example formatMoney(0, 'USD')     // '$0.00'
 */
export function formatMoney(amount: number, currency: string): string {
  if (!Number.isInteger(amount)) {
    throw new Error(`amount must be an integer (minor units), got ${amount}`);
  }

  const symbol = CURRENCY_SYMBOLS[currency];
  if (!symbol) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  const negative = amount < 0;
  const abs = Math.abs(amount);
  const major = Math.floor(abs / MINOR_UNIT_FACTOR);
  const minor = abs % MINOR_UNIT_FACTOR;
  const minorStr = minor.toString().padStart(2, '0');

  return `${negative ? '-' : ''}${symbol}${major}.${minorStr}`;
}

/**
 * Parse a formatted money string back into integer minor units.
 *
 * Accepts strings with or without the currency symbol, and with or without
 * commas as thousands separators. Exactly 2 decimal places are required.
 *
 * @example parseMoney('₹100.50', 'INR') // 10050
 * @example parseMoney('100.50', 'INR')   // 10050
 */
export function parseMoney(display: string, currency: string): number {
  const symbol = CURRENCY_SYMBOLS[currency];
  if (!symbol) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  // Strip currency symbol and commas, trim whitespace
  let cleaned = display.trim();
  if (cleaned.startsWith(symbol)) {
    cleaned = cleaned.slice(symbol.length);
  }
  // Handle negative sign that may precede the symbol
  let negative = false;
  if (cleaned.startsWith('-')) {
    negative = true;
    cleaned = cleaned.slice(1);
  }
  // Also check if negative sign was before the symbol
  if (display.trim().startsWith('-')) {
    negative = true;
    if (cleaned.startsWith(symbol)) {
      cleaned = cleaned.slice(symbol.length);
    }
  }

  cleaned = cleaned.replace(/,/g, '');

  const match = cleaned.match(/^(\d+)\.(\d{2})$/);
  if (!match) {
    throw new Error(
      `Invalid money format: "${display}". Expected format like "${symbol}123.45" or "123.45"`,
    );
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const result = major * MINOR_UNIT_FACTOR + minor;

  return negative ? -result : result;
}

/**
 * Split `total` minor units equally among `count` receivers.
 *
 * The remainder (total mod count) is distributed one extra unit to the
 * first N receivers when sorted in deterministic order (the caller is
 * expected to sort receiver IDs by UUID before indexing into the result).
 *
 * @returns An array of length `count` where each element is a share in minor units.
 * @throws If count is 0 or total is negative.
 */
export function splitEqually(total: number, count: number): number[] {
  if (!Number.isInteger(total)) {
    throw new Error(`total must be an integer, got ${total}`);
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`count must be a non-negative integer, got ${count}`);
  }
  if (count === 0) {
    if (total === 0) return [];
    throw new Error('Cannot split a non-zero total among 0 receivers');
  }
  if (total < 0) {
    throw new Error(`total must be non-negative, got ${total}`);
  }

  const base = Math.floor(total / count);
  const remainder = total % count;

  const shares: number[] = [];
  for (let i = 0; i < count; i++) {
    shares.push(i < remainder ? base + 1 : base);
  }

  return shares;
}

/**
 * Sum an array of share allocations. Useful for verifying that shares total
 * correctly after a split.
 */
export function sumAllocations(shares: number[]): number {
  let total = 0;
  for (const s of shares) {
    if (!Number.isInteger(s)) {
      throw new Error(`Each share must be an integer, got ${s}`);
    }
    total += s;
  }
  return total;
}
