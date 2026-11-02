import { useContext } from 'react'
import { AuthContext } from '../contexts/auth/auth-context'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
