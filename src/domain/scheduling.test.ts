import { describe, it, expect } from 'vitest'
import {
  calculatePeriodBounds,
  getCurrentDailyPeriod,
  isSameInstant,
  isValidTimezone,
  isWithinGracePeriod,
  isWithinReviewWindow,
  getNextPeriodStart,
} from './scheduling'

describe('isSameInstant', () => {
  it('treats PostgREST "+00:00" and JS "Z" timestamps as the same instant', () => {
    // Regression: string equality between these two never matched, so the
    // "current period" occurrence was never found and stale check-ins showed.
    expect(isSameInstant('2026-11-14T00:00:00+00:00', new Date('2026-11-14T00:00:00.000Z'))).toBe(true)
    expect(isSameInstant('2026-11-14T05:30:00+05:30', '2026-11-14T00:00:00Z')).toBe(true)
  })

  it('returns false for different or invalid instants', () => {
    expect(isSameInstant('2026-11-14T00:00:00Z', '2026-11-15T00:00:00Z')).toBe(false)
    expect(isSameInstant('not-a-date', 'not-a-date')).toBe(false)
  })
})

describe('isValidTimezone', () => {
  it('accepts IANA names and rejects offsets and garbage', () => {
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('Asia/Kolkata')).toBe(true)
    expect(isValidTimezone('America/New_York')).toBe(true)
    expect(isValidTimezone('+05:30')).toBe(false)
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
    expect(isValidTimezone('')).toBe(false)
  })
})

describe('getCurrentDailyPeriod', () => {
  it("rolls over at local midnight, not UTC midnight (Asia/Kolkata)", () => {
    // 2026-11-13T20:00Z is 01:30 on Nov 14 in IST. The habit's day is Nov 14.
    const period = getCurrentDailyPeriod('Asia/Kolkata', new Date('2026-11-13T20:00:00Z'))
    expect(period.start.toISOString()).toBe('2026-11-13T18:30:00.000Z')
    expect(period.end.toISOString()).toBe('2026-11-14T18:30:00.000Z')
  })

  it('falls back to UTC for missing or invalid timezones instead of throwing', () => {
    const now = new Date('2026-11-14T10:00:00Z')
    expect(getCurrentDailyPeriod(null, now).start.toISOString()).toBe('2026-11-14T00:00:00.000Z')
    expect(getCurrentDailyPeriod('Not/AZone', now).start.toISOString()).toBe('2026-11-14T00:00:00.000Z')
  })

  it('handles a DST transition day (America/New_York, spring forward)', () => {
    // 2026-03-08 is a 23-hour day in New York.
    const period = getCurrentDailyPeriod('America/New_York', new Date('2026-03-08T15:00:00Z'))
    expect(period.start.toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(period.end.toISOString()).toBe('2026-03-09T04:00:00.000Z')
  })
})

describe('calculatePeriodBounds', () => {
  it('calculates daily period bounds starting and ending at midnight in UTC', () => {
    const ref = new Date('2026-06-15T14:30:00Z')
    const bounds = calculatePeriodBounds('daily', ref, 'UTC')

    expect(bounds.start.toISOString()).toBe('2026-06-15T00:00:00.000Z')
    expect(bounds.end.toISOString()).toBe('2026-06-16T00:00:00.000Z')
  })

  it('calculates daily period bounds for non-UTC timezone', () => {
    // 2026-06-15 01:00 UTC is 2026-06-15 06:30 in Asia/Kolkata (+05:30)
    const ref = new Date('2026-06-15T01:00:00Z')
    const bounds = calculatePeriodBounds('daily', ref, 'Asia/Kolkata')

    // Asia/Kolkata midnight is 18:30 UTC previous day
    expect(bounds.start.toISOString()).toBe('2026-06-14T18:30:00.000Z')
    expect(bounds.end.toISOString()).toBe('2026-06-15T18:30:00.000Z')
  })

  it('calculates weekly period bounds starting on Monday', () => {
    // 2026-06-17 is Wednesday
    const ref = new Date('2026-06-17T12:00:00Z')
    const bounds = calculatePeriodBounds('weekly', ref, 'UTC')

    // Monday before 2026-06-17 was 2026-06-15
    expect(bounds.start.toISOString()).toBe('2026-06-15T00:00:00.000Z')
    // Next Monday is 2026-06-22
    expect(bounds.end.toISOString()).toBe('2026-06-22T00:00:00.000Z')
  })

  it('calculates monthly period bounds', () => {
    const ref = new Date('2026-06-17T12:00:00Z')
    const bounds = calculatePeriodBounds('monthly', ref, 'UTC')

    expect(bounds.start.toISOString()).toBe('2026-06-01T00:00:00.000Z')
    expect(bounds.end.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })
})

describe('isWithinGracePeriod', () => {
  const periodEnd = new Date('2026-06-15T00:00:00Z')
  const graceHours = 24

  it('returns true when now is within grace hours after periodEnd', () => {
    const inside = new Date('2026-06-15T12:00:00Z')
    expect(isWithinGracePeriod(periodEnd, inside, graceHours)).toBe(true)

    const exactEnd = new Date('2026-06-16T00:00:00Z')
    expect(isWithinGracePeriod(periodEnd, exactEnd, graceHours)).toBe(true)
  })

  it('returns false when now is before periodEnd or past grace period', () => {
    const before = new Date('2026-06-14T23:59:59Z')
    expect(isWithinGracePeriod(periodEnd, before, graceHours)).toBe(false)

    const after = new Date('2026-06-16T00:00:01Z')
    expect(isWithinGracePeriod(periodEnd, after, graceHours)).toBe(false)
  })
})

describe('isWithinReviewWindow', () => {
  const periodEnd = new Date('2026-06-15T00:00:00Z')
  const graceHours = 24
  const reviewHours = 48

  it('returns true when now is between end of grace and end of review', () => {
    // Grace ends at 2026-06-16 00:00:00Z, Review ends at 2026-06-18 00:00:00Z
    const duringReview = new Date('2026-06-17T00:00:00Z')
    expect(isWithinReviewWindow(periodEnd, graceHours, reviewHours, duringReview)).toBe(true)
  })

  it('returns false when now is within grace or past review', () => {
    const duringGrace = new Date('2026-06-15T12:00:00Z')
    expect(isWithinReviewWindow(periodEnd, graceHours, reviewHours, duringGrace)).toBe(false)

    const afterReview = new Date('2026-06-18T01:00:00Z')
    expect(isWithinReviewWindow(periodEnd, graceHours, reviewHours, afterReview)).toBe(false)
  })
})

describe('getNextPeriodStart', () => {
  it('returns matching contiguous period start date', () => {
    const end = new Date('2026-06-16T00:00:00Z')
    const nextStart = getNextPeriodStart('daily', end)
    expect(nextStart.toISOString()).toBe(end.toISOString())
  })
})
