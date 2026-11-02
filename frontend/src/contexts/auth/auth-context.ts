import { createContext } from 'react'
import type { User } from '../../api'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  signIn(input: { email: string; password: string }): Promise<void>
  signUp(input: { name: string; email: string; password: string }): Promise<void>
  logout(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
