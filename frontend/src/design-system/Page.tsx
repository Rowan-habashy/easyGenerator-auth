import type { ReactNode } from 'react'

const pageClass = 'min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50'

export function Page({ children }: { children: ReactNode }) {
  return <div className={pageClass}>{children}</div>
}
