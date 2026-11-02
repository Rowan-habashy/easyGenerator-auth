import type { ReactNode } from 'react'
import { AuthContext } from './auth-context'
import { useAuthSession } from '../../hooks/use-auth-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthSession()

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
