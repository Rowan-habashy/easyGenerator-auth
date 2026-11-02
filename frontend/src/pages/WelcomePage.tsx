import { useState } from 'react'
import { routes } from '../routes'
import { useAuth } from '../hooks/use-auth'
import { Brand, Button, LinkButton, Page as PageBackground } from '../design-system'

export function WelcomePage() {
  const { status, user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const authed = status === 'authenticated'

  return (
    <PageBackground>
      <header className="flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
        <Brand />
        <nav className="flex gap-2">
          {authed ? (
            <>
              <LinkButton to={routes.profile}>My profile</LinkButton>
              <Button
                variant="secondary"
                fullWidth={false}
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true)
                  await logout()
                }}
              >
                {loggingOut ? 'Logging out…' : 'Log out'}
              </Button>
            </>
          ) : (
            <>
              <LinkButton to={routes.login} variant="ghost">
                Log in
              </LinkButton>
              <LinkButton to={routes.signUp}>Sign up</LinkButton>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto my-20 max-w-2xl px-6 text-center">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {authed && user ? `Hello, ${user.name}` : 'Build faster with easyGenerator'}
        </h1>
        <p className="mt-4 text-lg text-slate-500">Secure sign in, sessions that stay alive, and a profile you control.</p>
        {!authed && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton to={routes.signUp} large>
              Get started
            </LinkButton>
            <LinkButton to={routes.login} variant="secondary" large>
              I have an account
            </LinkButton>
          </div>
        )}
      </main>
    </PageBackground>
  )
}
