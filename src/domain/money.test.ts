import { describe, it, expect } from 'vitest'
import {
  formatMoney,
  parseMoney,
  splitEqually,
  sumAllocations,
  CURRENCY_SYMBOLS,
} from './money'

describe('formatMoney', () => {
  it('formats minor units to major currency with 2 decimals', () => {
    expect(formatMoney(10000, 'INR')).toBe('₹100.00')
    expect(formatMoney(10050, 'INR')).toBe('₹100.50')
    expect(formatMoney(5, 'USD')).toBe('$0.05')
    expect(formatMoney(0, 'USD')).toBe('$0.00')
    expect(formatMoney(123456, 'EUR')).toBe('€1234.56')
    expect(formatMoney(99, 'GBP')).toBe('£0.99')
  })

  it('handles negative amounts correctly', () => {
    expect(formatMoney(-5000, 'INR')).toBe('-₹50.00')
  })

  it('throws on non-integer minor units', () => {
    expect(() => formatMoney(100.5, 'INR')).toThrow()
  })

  it('throws on unsupported currency', () => {
    expect(() => formatMoney(1000, 'XYZ')).toThrow()
  })
})

describe('parseMoney', () => {
  it('parses formatted strings with symbols into minor units', () => {
    expect(parseMoney('₹100.50', 'INR')).toBe(10050)
    expect(parseMoney('$0.05', 'USD')).toBe(5)
    expect(parseMoney('€1,234.56', 'EUR')).toBe(123456)
  })

  it('parses formatted strings without symbols', () => {
    expect(parseMoney('100.50', 'INR')).toBe(10050)
    expect(parseMoney('0.00', 'USD')).toBe(0)
  })

  it('parses negative amounts', () => {
    expect(parseMoney('-₹50.00', 'INR')).toBe(-5000)
    expect(parseMoney('-$50.00', 'USD')).toBe(-5000)
  })

  it('throws on invalid formats', () => {
    expect(() => parseMoney('100', 'INR')).toThrow()
    expect(() => parseMoney('abc', 'INR')).toThrow()
    expect(() => parseMoney('100.5', 'INR')).toThrow()
  })
})

describe('splitEqually', () => {
  it('splits evenly when divisible', () => {
    const shares = splitEqually(300, 3)
    expect(shares).toEqual([100, 100, 100])
    expect(sumAllocations(shares)).toBe(300)
  })

  it('allocates remainder 1 minor unit to first N receivers deterministically', () => {
    // 100 split 3 ways -> 33, 33, 33 with 1 remainder -> [34, 33, 33]
    const shares = splitEqually(100, 3)
    expect(shares).toEqual([34, 33, 33])
    expect(sumAllocations(shares)).toBe(100)

    // 1000 split 7 ways -> 142 each with 6 remainder -> 6 get 143, 1 gets 142
    const shares7 = splitEqually(1000, 7)
    expect(shares7).toEqual([143, 143, 143, 143, 143, 143, 142])
    expect(sumAllocations(shares7)).toBe(1000)
  })

  it('handles 0 total', () => {
    expect(splitEqually(0, 3)).toEqual([0, 0, 0])
    expect(splitEqually(0, 0)).toEqual([])
  })

  it('throws on 0 receivers with non-zero total', () => {
    expect(() => splitEqually(100, 0)).toThrow()
  })

  it('throws on negative totals or non-integers', () => {
    expect(() => splitEqually(-50, 2)).toThrow()
    expect(() => splitEqually(50.5, 2)).toThrow()
  })
})

describe('sumAllocations', () => {
  it('calculates exact sum of shares', () => {
    expect(sumAllocations([100, 200, 300])).toBe(600)
    expect(sumAllocations([])).toBe(0)
  })

  it('throws on non-integer share', () => {
    expect(() => sumAllocations([10, 20.5])).toThrow()
  })
})
