/**
 * Pure penalty calculation for HabitCircle.
 *
 * Penalties are computed in integer minor units. Equal splits distribute
 * the remainder deterministically to the first N receivers when sorted
 * by UUID ascending.
 */

import { splitEqually } from './money';

/** Immutable snapshot of a penalty calculation. */
export interface PenaltySnapshot {
  /** Total penalty in minor units (0 if target met). */
  readonly penaltyAmount: number;
  /** The check-in target (e.g. number of check-ins required). */
  readonly target: number;
  /** The actual number achieved. */
  readonly actual: number;
  /** Whether the target was met. */
  readonly targetMet: boolean;
  /** Allocation per eligible member, sorted by receiverId. */
  readonly allocations: ReadonlyArray<{ readonly receiverId: string; readonly share: number }>;
  /** Currency code (ISO 4217). */
  readonly currency: string;
}

/**
 * Calculate the penalty amount.
 *
 * Returns 0 if `actual >= target` (the user met their goal).
 * Returns the full `penaltyAmount` otherwise.
 *
 * @param target - Required count / goal.
 * @param actual - What the user actually achieved.
 * @param penaltyAmount - Penalty in minor units if the target is missed.
 */
export function calculatePenalty(
  target: number,
  actual: number,
  penaltyAmount: number,
): number {
  if (!Number.isInteger(penaltyAmount) || penaltyAmount < 0) {
    throw new Error(`penaltyAmount must be a non-negative integer, got ${penaltyAmount}`);
  }
  if (actual >= target) {
    return 0;
  }
  return penaltyAmount;
}

/**
 * Allocate a total penalty among eligible receivers.
 *
 * Receivers must be pre-sorted by UUID ascending. The remainder from
 * equal splitting is given one extra minor unit each to the first N.
 *
 * @returns Array of { receiverId, share } sorted by receiverId.
 * @throws If total is non-zero but there are no eligible receivers.
 */
export function allocatePenalty(
  total: number,
  eligibleReceiverIds: string[],
): { receiverId: string; share: number }[] {
  if (total === 0) {
    return eligibleReceiverIds.map((id) => ({ receiverId: id, share: 0 }));
  }

  // Sort deterministically by UUID
  const sorted = [...eligibleReceiverIds].sort();

  if (sorted.length === 0) {
    throw new Error('Cannot allocate a non-zero penalty with no eligible receivers');
  }

  const shares = splitEqually(total, sorted.length);

  return sorted.map((id, i) => ({
    receiverId: id,
    share: shares[i],
  }));
}

/**
 * Create a full penalty snapshot from the given parameters.
 */
export function createPenaltySnapshot(params: {
  penaltyAmount: number;
  target: number;
  actual: number;
  eligibleMembers: string[];
  currency: string;
}): PenaltySnapshot {
  const { penaltyAmount, target, actual, eligibleMembers, currency } = params;

  const effectivePenalty = calculatePenalty(target, actual, penaltyAmount);
  const allocations = allocatePenalty(effectivePenalty, eligibleMembers);

  return {
    penaltyAmount: effectivePenalty,
    target,
    actual,
    targetMet: actual >= target,
    allocations,
    currency,
  };
}
