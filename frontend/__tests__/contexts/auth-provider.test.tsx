import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../src/contexts/auth/auth-context'
import { AuthProvider } from '../../src/contexts/auth/AuthProvider'

const mockedSession = {
  status: 'authenticated' as const,
  user: { id: 'u1', email: 'a@b.com', name: 'A', createdAt: '2026-01-01' },
  signIn: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
}

vi.mock('../../src/hooks/use-auth-session', () => ({
  useAuthSession: vi.fn(() => mockedSession),
}))

describe('auth context/provider', () => {
  it('auth context exposes a provider', () => {
    expect(AuthContext.Provider).toBeDefined()
  })

  it('AuthProvider provides value returned by useAuthSession', () => {
    const child = { type: 'div', props: {}, key: null }
    const element = AuthProvider({ children: child })

    expect(element).not.toBeNull()
    if (!element) return

    expect(element.type).toBe(AuthContext.Provider)
    expect(element.props.value).toBe(mockedSession)
    expect(element.props.children).toBe(child)
  })
})
