import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockClient = {
  setAccessToken: vi.fn(),
  addApiMiddleware: vi.fn(() => vi.fn()),
  setApiMiddlewares: vi.fn(),
  refreshSession: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
  request: vi.fn(),
  authenticate: vi.fn(),
}

vi.mock('../../src/services/api-client', () => ({
  createApiClient: vi.fn(() => mockClient),
}))

describe('api facade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates session/token and middleware operations to the api client', async () => {
    const api = await import('../../src/api')

    const middleware = { onRequest: vi.fn() }
    const sessionHandler = vi.fn()

    api.setAccessToken('token-1')
    api.addApiMiddleware(middleware)
    api.setApiMiddlewares([middleware])
    api.setSessionExpiredHandler(sessionHandler)
    await api.refreshSession()

    expect(mockClient.setAccessToken).toHaveBeenCalledWith('token-1')
    expect(mockClient.addApiMiddleware).toHaveBeenCalledWith(middleware)
    expect(mockClient.setApiMiddlewares).toHaveBeenCalledWith([middleware])
    expect(mockClient.setSessionExpiredHandler).toHaveBeenCalledWith(sessionHandler)
    expect(mockClient.refreshSession).toHaveBeenCalledTimes(1)
  })

  it('authenticate returns only user payload from session response', async () => {
    const api = await import('../../src/api')
    const user = { id: 'u1', email: 'a@b.com', name: 'A', createdAt: '2026-01-01' }
    mockClient.authenticate.mockResolvedValueOnce({ accessToken: 'token', user })

    await expect(api.authenticate('/auth/signin', { email: 'a@b.com', password: 'secret' })).resolves.toEqual(user)
    expect(mockClient.authenticate).toHaveBeenCalledWith('/auth/signin', { email: 'a@b.com', password: 'secret' })
  })
})
