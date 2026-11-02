import { describe, expect, it } from 'vitest'
import { routes } from '../../src/routes'

describe('routes contract', () => {
  it('exposes stable application paths', () => {
    expect(routes).toEqual({
      welcome: '/',
      login: '/login',
      signUp: '/signup',
      profile: '/profile',
    })
  })

  it('uses unique route values', () => {
    const values = Object.values(routes)
    expect(new Set(values).size).toBe(values.length)
  })
})
