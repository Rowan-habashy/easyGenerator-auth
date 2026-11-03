import { LIMITS } from './index'

export type Validator = (value: string) => string | undefined

export const validateRequired = (field: string): Validator => (value) =>
  value.trim() ? undefined : `${field} is required.`

export const validateEmail: Validator = (value) => {
  if (!value.trim()) return 'Email is required.'
  if (value.length > LIMITS.EMAIL_MAX) return `Email must be at most ${LIMITS.EMAIL_MAX} characters.`
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  return ok ? undefined : 'Enter a valid email address.'
}

export const validateName: Validator = (value) => {
  const name = value.trim()
  if (!name) return 'Name is required.'
  if (name.length < LIMITS.NAME_MIN) return `Name must be at least ${LIMITS.NAME_MIN} characters.`
  if (name.length > LIMITS.NAME_MAX) return `Name must be at most ${LIMITS.NAME_MAX} characters.`
  return undefined
}

export const validateNewPassword: Validator = (value) => {
  if (!value) return 'Password is required.'
  if (value.length < LIMITS.PASSWORD_MIN) return `Password must be at least ${LIMITS.PASSWORD_MIN} characters.`
  if (value.length > LIMITS.PASSWORD_MAX) return `Password must be at most ${LIMITS.PASSWORD_MAX} characters.`
  if (!/[A-Za-z]/.test(value)) return 'Password must include at least one letter.'
  if (!/[0-9]/.test(value)) return 'Password must include at least one number.'
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include at least one special character.'
  return undefined
}
