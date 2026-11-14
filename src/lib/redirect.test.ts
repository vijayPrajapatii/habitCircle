import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from './redirect'

describe('safeRedirectPath', () => {
  it('keeps same-origin paths, including query strings', () => {
    expect(safeRedirectPath('/dashboard/groups')).toBe('/dashboard/groups')
    expect(safeRedirectPath('/invite/accept?token=abc-123')).toBe('/invite/accept?token=abc-123')
  })

  it('falls back when missing or blank', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard')
    expect(safeRedirectPath(undefined)).toBe('/dashboard')
    expect(safeRedirectPath('')).toBe('/dashboard')
    expect(safeRedirectPath('   ')).toBe('/dashboard')
  })

  it('rejects anything that could leave the site', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/dashboard')
    expect(safeRedirectPath('//evil.com')).toBe('/dashboard')
    expect(safeRedirectPath('/\\evil.com')).toBe('/dashboard')
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/dashboard')
    expect(safeRedirectPath('evil.com/path')).toBe('/dashboard')
  })

  it('rejects control characters browsers would strip into //', () => {
    expect(safeRedirectPath('/\t/evil.com')).toBe('/dashboard')
    expect(safeRedirectPath('/\n/evil.com')).toBe('/dashboard')
  })

  it('uses a custom fallback', () => {
    expect(safeRedirectPath('//evil.com', '/login')).toBe('/login')
  })
})
