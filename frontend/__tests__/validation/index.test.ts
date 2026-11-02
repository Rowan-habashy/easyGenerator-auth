import { describe, expect, it } from 'vitest'
import { LIMITS } from '../../src/validation'

describe('validation limits', () => {
  it('keeps limits in expected ranges', () => {
    expect(LIMITS.EMAIL_MAX).toBeGreaterThan(100)
    expect(LIMITS.NAME_MAX).toBeGreaterThanOrEqual(50)
    expect(LIMITS.PASSWORD_MIN).toBeGreaterThanOrEqual(8)
    expect(LIMITS.PASSWORD_MAX).toBeGreaterThan(LIMITS.PASSWORD_MIN)
  })

  it('exports immutable numeric values', () => {
    for (const [key, value] of Object.entries(LIMITS)) {
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThan(0)
      expect(key).toMatch(/^[A-Z_]+$/)
    }
  })
})
