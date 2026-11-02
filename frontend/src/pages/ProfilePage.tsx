import { useState } from 'react'
import { type User } from '../api'
import { Button, Card } from '../components/ui'

export function ProfilePage({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    await onLogout() 
  }

  const joined = new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const rows = [
    ['Name', user.name],
    ['Email', user.email],
    ['Member since', joined],
  ]

  return (
    <Card>
      <div className="text-center">
        <div className="mx-auto mb-2 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-purple-500 text-3xl font-bold text-white">
          {user.name.trim().charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{user.name}</h1>
        <p className="mb-5 text-slate-500">{user.email}</p>
      </div>
      <dl className="mb-6 divide-y divide-slate-100 border-y border-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="m-0 break-all font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <Button variant="secondary" disabled={loading} onClick={logout}>
        {loading ? 'Logging out…' : 'Log out'}
      </Button>
    </Card>
  )
}
