/**
 * Pure money math helpers for HabitCircle.
 *
 * All monetary values are stored as integer minor units (e.g. paise for INR,
 * cents for USD). This module NEVER uses floats for money arithmetic.
 */

/** Currencies HabitCircle supports. There is no conversion between them. */
export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;

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
 * Display-safe variant of {@link formatMoney} for rendering stored data.
 *
 * `formatMoney` throws on an unsupported currency or a non-integer amount,
 * which would crash a whole page if one bad row reached the UI. This never
 * throws: it falls back to "<CODE> 12.34" (or "—" for a non-finite amount).
 */
export function formatMoneySafe(amount: number | null | undefined, currency: string): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  // Stored values should already be integers; rounding only guards display.
  const rounded = Math.round(amount);
  try {
    return formatMoney(rounded, currency);
  } catch {
    const negative = rounded < 0;
    const abs = Math.abs(rounded);
    const major = Math.floor(abs / MINOR_UNIT_FACTOR);
    const minor = (abs % MINOR_UNIT_FACTOR).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${currency || ''} ${major}.${minor}`.trim();
  }
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
 * Convert a user-typed amount in major units (e.g. "250" or "10.5") into
 * integer minor units without any floating point arithmetic.
 *
 * Accepts digits with an optional decimal part of at most 2 places. Returns
 * `null` for anything else (empty, negative, 3+ decimals, exponent notation,
 * non-numeric) so callers can show a validation message instead of guessing.
 *
 * @example parseMajorUnits('250')   // 25000
 * @example parseMajorUnits('10.5')  // 1050
 * @example parseMajorUnits('10.555') // null
 */
export function parseMajorUnits(input: string): number | null {
  const match = input.trim().match(/^(\d{1,9})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const major = parseInt(match[1], 10);
  const minor = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
  return major * MINOR_UNIT_FACTOR + minor;
}

/**
 * Render integer minor units as a plain major-unit string for form inputs,
 * dropping a ".00" suffix: 25000 → "250", 1050 → "10.50".
 */
export function minorToMajorInput(minor: number): string {
  const whole = Math.floor(Math.abs(minor) / MINOR_UNIT_FACTOR);
  const frac = Math.abs(minor) % MINOR_UNIT_FACTOR;
  const sign = minor < 0 ? '-' : '';
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${frac.toString().padStart(2, '0')}`;
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
