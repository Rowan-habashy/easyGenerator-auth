import type { ReactNode } from 'react'

const alertClass = 'mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700'

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className={alertClass}>
      {children}
    </div>
  )
}
