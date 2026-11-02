import { describe, expect, it, vi } from 'vitest'

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useContext: vi.fn(),
  }
})

import { useContext } from 'react'
import { useAuth } from '../../src/hooks/use-auth'

describe('useAuth hook', () => {
  it('throws when used outside AuthProvider context', () => {
    vi.mocked(useContext).mockReturnValueOnce(null)
    expect(() => useAuth()).toThrow('useAuth must be used within AuthProvider')
  })

  it('returns auth context value when provider is available', () => {
    const contextValue = {
      status: 'authenticated',
      user: { id: 'u1', email: 'a@b.com', name: 'A', createdAt: '2026-01-01' },
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
    }

    vi.mocked(useContext).mockReturnValueOnce(contextValue)
    expect(useAuth()).toBe(contextValue)
  })
})
