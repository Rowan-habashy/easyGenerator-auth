import { Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { Spinner } from '../../design-system'
import { routes } from '../../routes'
import { useAuth } from '../../hooks/use-auth'

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { status } = useAuth()
  if (status === 'loading') return <Spinner />
  if (status !== 'authenticated') return <Navigate to={routes.login} replace />
  return children
}

export function GuestRoute({ children }: { children: ReactElement }) {
  const { status } = useAuth()
  if (status === 'loading') return <Spinner />
  if (status === 'authenticated') return <Navigate to={routes.welcome} replace />
  return children
}
