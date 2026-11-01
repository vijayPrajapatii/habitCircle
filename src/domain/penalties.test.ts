import { describe, it, expect } from 'vitest'
import {
  calculatePenalty,
  allocatePenalty,
  createPenaltySnapshot,
} from './penalties'
import { sumAllocations } from './money'

describe('calculatePenalty', () => {
  it('returns 0 when actual meets or exceeds target', () => {
    expect(calculatePenalty(5, 5, 1000)).toBe(0)
    expect(calculatePenalty(5, 7, 1000)).toBe(0)
  })

  it('returns full penalty when actual is less than target', () => {
    expect(calculatePenalty(5, 4, 1000)).toBe(1000)
    expect(calculatePenalty(1, 0, 500)).toBe(500)
  })

  it('throws on negative or invalid penalty amount', () => {
    expect(() => calculatePenalty(5, 2, -100)).toThrow()
  })
})

describe('allocatePenalty', () => {
  it('splits penalty among sorted receiver IDs', () => {
    const receivers = ['user-c', 'user-a', 'user-b']
    // When sorted: user-a, user-b, user-c
    // 100 minor units split among 3: [34, 33, 33]
    const allocations = allocatePenalty(100, receivers)

    expect(allocations).toEqual([
      { receiverId: 'user-a', share: 34 },
      { receiverId: 'user-b', share: 33 },
      { receiverId: 'user-c', share: 33 },
    ])

    const total = sumAllocations(allocations.map(a => a.share))
    expect(total).toBe(100)
  })

  it('returns zero share for each receiver if total penalty is 0', () => {
    const allocations = allocatePenalty(0, ['user-1', 'user-2'])
    expect(allocations).toEqual([
      { receiverId: 'user-1', share: 0 },
      { receiverId: 'user-2', share: 0 },
    ])
  })

  it('throws when total is non-zero but eligible receivers list is empty', () => {
    expect(() => allocatePenalty(500, [])).toThrow()
  })
})

describe('createPenaltySnapshot', () => {
  it('creates an immutable snapshot with targetMet = true', () => {
    const snapshot = createPenaltySnapshot({
      penaltyAmount: 1000,
      target: 5,
      actual: 5,
      eligibleMembers: ['user-a', 'user-b'],
      currency: 'INR',
    })

    expect(snapshot.targetMet).toBe(true)
    expect(snapshot.penaltyAmount).toBe(0)
    expect(snapshot.allocations[0].share).toBe(0)
    expect(snapshot.allocations[1].share).toBe(0)
    expect(snapshot.currency).toBe('INR')
  })

  it('creates a snapshot with penalty distributed when target is missed', () => {
    const snapshot = createPenaltySnapshot({
      penaltyAmount: 1000,
      target: 5,
      actual: 3,
      eligibleMembers: ['user-b', 'user-a'],
      currency: 'INR',
    })

    expect(snapshot.targetMet).toBe(false)
    expect(snapshot.penaltyAmount).toBe(1000)
    // 1000 / 2 = 500 each
    expect(snapshot.allocations).toEqual([
      { receiverId: 'user-a', share: 500 },
      { receiverId: 'user-b', share: 500 },
    ])
  })
})
