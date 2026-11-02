import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { refreshSession, request, setAccessToken, setSessionExpiredHandler } from './api'
import type { User } from './api'
import { Spinner } from './components/ui'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { SignUpPage } from './pages/SignUpPage'
import { WelcomePage } from './pages/WelcomePage'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [restoringSession, setRestoringSession] = useState(true)

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null))
    refreshSession()
      .then(() => request<User>('/users/me', { auth: true }))
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setRestoringSession(false))
  }, [])

  async function logout() {
    try {
      await request<void>('/auth/logout', { method: 'POST', auth: true })
    } catch {
      // clear local state even if the server call fails
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }

  if (restoringSession) return <Spinner />

  return (
    <Routes>
      <Route path="/" element={<WelcomePage user={user} onLogout={logout} />} />
      <Route path="/login" element={user ? <Navigate to="/profile" replace /> : <LoginPage onLogin={setUser} />} />
      <Route path="/signup" element={user ? <Navigate to="/profile" replace /> : <SignUpPage onLogin={setUser} />} />
      <Route path="/profile" element={user ? <ProfilePage user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
