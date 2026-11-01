import { describe, it, expect } from 'vitest'
import {
  canTransitionCheckin,
  getAvailableCheckinTransitions,
  canTransitionPenalty,
  getAvailablePenaltyTransitions,
  canTransitionPayment,
  getAvailablePaymentTransitions,
  ALL_CHECKIN_STATUSES,
  ALL_PENALTY_STATUSES,
  ALL_PAYMENT_STATUSES,
} from './checkin-state'

describe('Checkin state transitions', () => {
  it('allows valid transitions from pending', () => {
    expect(canTransitionCheckin('pending', 'submitted')).toBe(true)
    expect(canTransitionCheckin('pending', 'missed')).toBe(true)
    expect(canTransitionCheckin('pending', 'excused')).toBe(true)
    expect(canTransitionCheckin('pending', 'verified')).toBe(false)
  })

  it('allows valid transitions from submitted', () => {
    expect(canTransitionCheckin('submitted', 'verified')).toBe(true)
    expect(canTransitionCheckin('submitted', 'disputed')).toBe(true)
    expect(canTransitionCheckin('submitted', 'missed')).toBe(true)
    expect(canTransitionCheckin('submitted', 'excused')).toBe(true)
    expect(canTransitionCheckin('submitted', 'pending')).toBe(false)
  })

  it('treats verified and excused as terminal states', () => {
    expect(getAvailableCheckinTransitions('verified')).toEqual([])
    expect(getAvailableCheckinTransitions('excused')).toEqual([])

    for (const status of ALL_CHECKIN_STATUSES) {
      expect(canTransitionCheckin('verified', status)).toBe(false)
      expect(canTransitionCheckin('excused', status)).toBe(false)
    }
  })
})

describe('Penalty state transitions', () => {
  it('allows transition from open to reversed and paid', () => {
    expect(canTransitionPenalty('open', 'paid')).toBe(true)
    expect(canTransitionPenalty('open', 'reversed')).toBe(true)
    expect(canTransitionPenalty('open', 'open')).toBe(false)
  })

  it('allows reversal from paid state', () => {
    expect(canTransitionPenalty('paid', 'reversed')).toBe(true)
    expect(canTransitionPenalty('paid', 'open')).toBe(false)
  })

  it('treats reversed as terminal', () => {
    expect(getAvailablePenaltyTransitions('reversed')).toEqual([])
  })
})

describe('Payment state transitions', () => {
  it('allows pending to transition to confirmed or rejected', () => {
    expect(canTransitionPayment('pending', 'confirmed')).toBe(true)
    expect(canTransitionPayment('pending', 'rejected')).toBe(true)
    expect(canTransitionPayment('pending', 'pending')).toBe(false)
  })

  it('treats confirmed as terminal', () => {
    expect(getAvailablePaymentTransitions('confirmed')).toEqual([])
  })

  it('allows rejected payment to transition back to pending for resubmission', () => {
    expect(canTransitionPayment('rejected', 'pending')).toBe(true)
    expect(canTransitionPayment('rejected', 'confirmed')).toBe(false)
  })
})
