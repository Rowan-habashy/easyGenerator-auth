import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthResolvedRoute, GuestRoute, ProtectedRoute } from '../../src/contexts/auth/route-guards'
import { useAuth } from '../../src/hooks/use-auth'

vi.mock('../../src/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

describe('route guards', () => {
  it('AuthResolvedRoute renders nothing while loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'loading',
      user: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
    })

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, undefined, createElement(AuthResolvedRoute, { children: createElement('div', undefined, 'x') }))
    )

    expect(html).toBe('')
  })

  it('ProtectedRoute redirects anonymous users to login', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'anonymous',
      user: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
    })

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, undefined, createElement(ProtectedRoute, { children: createElement('div', undefined, 'secret') }))
    )

    expect(html).toBe('')
  })

  it('GuestRoute redirects authenticated users to welcome', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', email: 'a@b.com', name: 'A', createdAt: '2026-01-01' },
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
    })

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, undefined, createElement(GuestRoute, { children: createElement('div', undefined, 'guest') }))
    )

    expect(html).toBe('')
  })

  it('ProtectedRoute renders children when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', email: 'a@b.com', name: 'A', createdAt: '2026-01-01' },
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
    })

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, undefined, createElement(ProtectedRoute, { children: createElement('div', undefined, 'secret') }))
    )

    expect(html).toContain('secret')
  })
})
