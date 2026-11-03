import { describe, expect, it } from 'vitest'
import { LIMITS } from '../../src/validation'
import { validateEmail, validateName, validateNewPassword, validateRequired } from '../../src/validation/validators'

describe('validators', () => {
  it('validateRequired returns error for blank and undefined for non-empty', () => {
    const validator = validateRequired('Email')
    expect(validator('')).toBe('Email is required.')
    expect(validator('   ')).toBe('Email is required.')
    expect(validator('hello')).toBeUndefined()
  })

  it('validateEmail checks required, format and max length', () => {
    expect(validateEmail('')).toBe('Email is required.')
    expect(validateEmail('bad-email')).toBe('Enter a valid email address.')
    expect(validateEmail(`${'a'.repeat(LIMITS.EMAIL_MAX)}@x.com`)).toBe(`Email must be at most ${LIMITS.EMAIL_MAX} characters.`)
    expect(validateEmail('person@example.com')).toBeUndefined()
  })

  it('validateName trims and enforces min/max length', () => {
    expect(validateName('   ')).toBe('Name is required.')
    expect(validateName('ab')).toBe(`Name must be at least ${LIMITS.NAME_MIN} characters.`)
    expect(validateName('a'.repeat(LIMITS.NAME_MAX + 1))).toBe(`Name must be at most ${LIMITS.NAME_MAX} characters.`)
    expect(validateName(' Rowan ')).toBeUndefined()
  })

  it('validateNewPassword checks required, bounds, and complexity', () => {
    expect(validateNewPassword('')).toBe('Password is required.')
    expect(validateNewPassword('a'.repeat(LIMITS.PASSWORD_MIN - 1))).toBe(
      `Password must be at least ${LIMITS.PASSWORD_MIN} characters.`,
    )
    expect(validateNewPassword('a'.repeat(LIMITS.PASSWORD_MAX + 1))).toBe(
      `Password must be at most ${LIMITS.PASSWORD_MAX} characters.`,
    )
    expect(validateNewPassword('abcdefgh')).toBe('Password must include at least one number.')
    expect(validateNewPassword('abcd1234')).toBe('Password must include at least one special character.')
    expect(validateNewPassword('1234567!')).toBe('Password must include at least one letter.')
    expect(validateNewPassword('Abcd1234!')).toBeUndefined()
  })
})
