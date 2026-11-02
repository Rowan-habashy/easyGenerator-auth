import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/use-auth'
import { routes } from '../routes'
import { Button, Card } from '../design-system'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="m-0 break-all font-semibold">{value}</dd>
    </div>
  )
}

export function ProfilePage() {
  const { user, logout } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!user) return null

  const joined = new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  return (
  <Card>
      <div className="mb-3">
        <Link to={routes.welcome} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900">
          <span aria-hidden="true">←</span>
          Back
        </Link>
      </div>
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-2 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-purple-500 text-3xl font-bold text-white"
        >
          {user.name.trim().charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{user.name}</h1>
        <p className="mb-5 text-slate-500">{user.email}</p>
      </div>
      <dl className="mb-6 divide-y divide-slate-100 border-y border-slate-100">
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Member since" value={joined} />
      </dl>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await logout()
        }}
      >
        {busy ? 'Logging out…' : 'Log out'}
      </Button>
    </Card>
  )
}
