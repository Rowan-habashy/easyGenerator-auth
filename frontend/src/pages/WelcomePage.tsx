import { useState } from 'react'
import type { User } from '../api'
import { Brand, Button, LinkButton, Page } from '../components/ui'

export function WelcomePage({ user, onLogout }: { user: User | null; onLogout: () => Promise<void> }) {
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    await onLogout()
    setLoggingOut(false)
  }

  return (
    <Page>
      <header className="flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
        <Brand />
        <nav className="flex gap-2">
          {user ? (
            <>
              <LinkButton to="/profile">My profile</LinkButton>
              <Button variant="secondary" fullWidth={false} disabled={loggingOut} onClick={logout}>
                {loggingOut ? 'Logging out…' : 'Log out'}
              </Button>
            </>
          ) : (
            <>
              <LinkButton to="/login" variant="ghost">
                Log in
              </LinkButton>
              <LinkButton to="/signup">Sign up</LinkButton>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto my-20 max-w-2xl px-6 text-center">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {user ? `Hello, ${user.name}` : 'Build faster with easyGenerator'}
        </h1>
        <p className="mt-4 text-lg text-slate-500">Secure sign in, sessions that stay alive, and a profile you control.</p>
        {!user && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton to="/signup" large>
              Get started
            </LinkButton>
            <LinkButton to="/login" variant="secondary" large>
              I have an account
            </LinkButton>
          </div>
        )}
      </main>
    </Page>
  )
}
