import { Navigate, Route, Routes } from 'react-router-dom'
import { routes } from './routes'
import { AuthResolvedRoute, GuestRoute, ProtectedRoute } from './contexts/auth/route-guards'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { SignUpPage } from './pages/SignUpPage'
import { WelcomePage } from './pages/WelcomePage'

export default function App() {
  return (
    <Routes>
      <Route
        path={routes.welcome}
        element={
          <AuthResolvedRoute>
            <WelcomePage />
          </AuthResolvedRoute>
        }
      />
      <Route
        path={routes.login}
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path={routes.signUp}
        element={
          <GuestRoute>
            <SignUpPage />
          </GuestRoute>
        }
      />
      <Route
        path={routes.profile}
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={routes.welcome} replace />} />
    </Routes>
  )
}
