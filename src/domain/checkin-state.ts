/**
 * State machines for check-in, penalty, and payment lifecycles.
 *
 * Each status type has a defined set of valid transitions. Functions are
 * pure and side-effect-free.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckinStatus =
  | 'pending'
  | 'submitted'
  | 'verified'
  | 'missed'
  | 'disputed'
  | 'excused';

export type PenaltyStatus = 'open' | 'reversed' | 'paid';

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

// ---------------------------------------------------------------------------
// Transition tables
// ---------------------------------------------------------------------------

/**
 * Valid check-in status transitions.
 *
 * ```
 * pending  → submitted | missed | excused
 * submitted → verified | missed | disputed | excused
 * disputed  → verified | missed | excused
 * verified  → (terminal)
 * missed    → disputed | excused
 * excused   → (terminal)
 * ```
 */
const CHECKIN_TRANSITIONS: Readonly<Record<CheckinStatus, readonly CheckinStatus[]>> = {
  pending: ['submitted', 'missed', 'excused'],
  submitted: ['verified', 'missed', 'disputed', 'excused'],
  disputed: ['verified', 'missed', 'excused'],
  verified: [],
  missed: ['disputed', 'excused'],
  excused: [],
} as const;

/**
 * Valid penalty status transitions.
 *
 * ```
 * open     → reversed | paid
 * reversed → (terminal)
 * paid     → reversed
 * ```
 */
const PENALTY_TRANSITIONS: Readonly<Record<PenaltyStatus, readonly PenaltyStatus[]>> = {
  open: ['reversed', 'paid'],
  reversed: [],
  paid: ['reversed'],
} as const;

/**
 * Valid payment status transitions.
 *
 * ```
 * pending   → confirmed | rejected
 * confirmed → (terminal)
 * rejected  → pending
 * ```
 */
const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  pending: ['confirmed', 'rejected'],
  confirmed: [],
  rejected: ['pending'],
} as const;

// ---------------------------------------------------------------------------
// Check-in helpers
// ---------------------------------------------------------------------------

/** All possible check-in statuses. */
export const ALL_CHECKIN_STATUSES: readonly CheckinStatus[] = [
  'pending',
  'submitted',
  'verified',
  'missed',
  'disputed',
  'excused',
] as const;

/** Returns true if transitioning from `current` to `next` is valid. */
export function canTransitionCheckin(
  current: CheckinStatus,
  next: CheckinStatus,
): boolean {
  const allowed = CHECKIN_TRANSITIONS[current];
  return allowed.includes(next);
}

/** Returns the list of statuses reachable from `current`. */
export function getAvailableCheckinTransitions(
  current: CheckinStatus,
): readonly CheckinStatus[] {
  return CHECKIN_TRANSITIONS[current];
}

// ---------------------------------------------------------------------------
// Penalty helpers
// ---------------------------------------------------------------------------

/** All possible penalty statuses. */
export const ALL_PENALTY_STATUSES: readonly PenaltyStatus[] = [
  'open',
  'reversed',
  'paid',
] as const;

/** Returns true if transitioning from `current` to `next` is valid. */
export function canTransitionPenalty(
  current: PenaltyStatus,
  next: PenaltyStatus,
): boolean {
  const allowed = PENALTY_TRANSITIONS[current];
  return allowed.includes(next);
}

/** Returns the list of statuses reachable from `current`. */
export function getAvailablePenaltyTransitions(
  current: PenaltyStatus,
): readonly PenaltyStatus[] {
  return PENALTY_TRANSITIONS[current];
}

// ---------------------------------------------------------------------------
// Payment helpers
// ---------------------------------------------------------------------------

/** All possible payment statuses. */
export const ALL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'confirmed',
  'rejected',
] as const;

/** Returns true if transitioning from `current` to `next` is valid. */
export function canTransitionPayment(
  current: PaymentStatus,
  next: PaymentStatus,
): boolean {
  const allowed = PAYMENT_TRANSITIONS[current];
  return allowed.includes(next);
}

/** Returns the list of statuses reachable from `current`. */
export function getAvailablePaymentTransitions(
  current: PaymentStatus,
): readonly PaymentStatus[] {
  return PAYMENT_TRANSITIONS[current];
}
