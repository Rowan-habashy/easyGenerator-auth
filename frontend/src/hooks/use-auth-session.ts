import { useCallback, useEffect, useMemo, useState } from 'react'
import { authenticate, refreshSession, request, setAccessToken, setSessionExpiredHandler } from '../api'
import type { User } from '../api'
import type { AuthContextValue, AuthStatus } from '../contexts/auth/auth-context'

type AuthPath = '/auth/signin' | '/auth/signup'

export function useAuthSession(): AuthContextValue {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('anonymous')
  }, [])

  const applyAuthenticatedUser = useCallback((next: User) => {
    setUser(next)
    setStatus('authenticated')
  }, [])

  const authenticateAndApply = useCallback(
    async (path: AuthPath, input: Parameters<AuthContextValue['signIn']>[0] | Parameters<AuthContextValue['signUp']>[0]) => {
      const next = await authenticate(path, input)
      applyAuthenticatedUser(next)
    },
    [applyAuthenticatedUser],
  )

  const signIn: AuthContextValue['signIn'] = useCallback(
    async (input) => authenticateAndApply('/auth/signin', input),
    [authenticateAndApply],
  )

  const signUp: AuthContextValue['signUp'] = useCallback(
    async (input) => authenticateAndApply('/auth/signup', input),
    [authenticateAndApply],
  )

  const logout: AuthContextValue['logout'] = useCallback(async () => {
    try {
      await request<void>('/auth/logout', { method: 'POST', auth: true })
    } finally {
      clearSession()
    }
  }, [clearSession])

  const restoreSession = useCallback(async () => {
    await refreshSession()
    const profile = await request<User>('/users/me', { auth: true })
    applyAuthenticatedUser(profile)
  }, [applyAuthenticatedUser])

  useEffect(() => {
    setSessionExpiredHandler(clearSession)

    let isActive = true

    const restore = async () => {
      try {
        await restoreSession()
      } catch {
        if (!isActive) return
        clearSession()
      }
    }

    void restore()

    return () => {
      isActive = false
      setSessionExpiredHandler(() => {})
    }
  }, [clearSession, restoreSession])

  return useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signIn,
      signUp,
      logout,
    }),
    [status, user, signIn, signUp, logout],
  )
}
