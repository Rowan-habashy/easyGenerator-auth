import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { WelcomePage } from '../../src/pages/WelcomePage'
import { useAuth } from '../../src/hooks/use-auth'

vi.mock('../../src/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}))

describe('WelcomePage', () => {
  it('shows auth actions for anonymous users', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'anonymous',
      user: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
    })

    const html = renderToStaticMarkup(createElement(MemoryRouter, undefined, createElement(WelcomePage)))
    expect(html).toContain('Build faster with easyGenerator')
    expect(html).toContain('Log in')
    expect(html).toContain('Sign up')
  })

  it('greets authenticated users and shows profile action', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', email: 'a@b.com', name: 'Rowan', createdAt: '2026-01-01' },
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
    })

    const html = renderToStaticMarkup(createElement(MemoryRouter, undefined, createElement(WelcomePage)))
    expect(html).toContain('Hello, Rowan')
    expect(html).toContain('My profile')
    expect(html).not.toContain('Get started')
  })
})
