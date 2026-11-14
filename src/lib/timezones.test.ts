import { describe, it, expect } from 'vitest'
import { COMMON_TIMEZONES, timezoneOptions, formatTimezoneLabel } from './timezones'
import { isValidTimezone } from '@/domain/scheduling'
import { isValidUsername, normalizeUsername } from './username'

describe('timezoneOptions', () => {
  it('keeps an unusual saved timezone selectable instead of silently showing UTC', () => {
    const options = timezoneOptions('Africa/Nairobi')
    expect(options[0]).toBe('Africa/Nairobi')
    expect(options).toContain('UTC')
  })

  it('does not duplicate a timezone that is already listed', () => {
    const options = timezoneOptions('Asia/Kolkata')
    expect(options.filter(tz => tz === 'Asia/Kolkata')).toHaveLength(1)
  })

  it('only offers real IANA zones the runtime understands', () => {
    for (const tz of COMMON_TIMEZONES) expect(isValidTimezone(tz)).toBe(true)
  })

  it('formats labels for display', () => {
    expect(formatTimezoneLabel('America/New_York')).toBe('America/New York')
  })
})

describe('username validation', () => {
  it('normalizes and accepts valid handles', () => {
    expect(normalizeUsername('  Alex_Run ')).toBe('alex_run')
    expect(isValidUsername('  Alex_Run ')).toBe(true)
  })

  it('rejects handles the database CHECK constraint would reject', () => {
    for (const bad of ['ab', 'a'.repeat(31), 'has space', 'dash-ed', 'émoji', '']) {
      expect(isValidUsername(bad)).toBe(false)
    }
  })
})
