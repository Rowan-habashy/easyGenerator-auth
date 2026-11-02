import type { ReactNode } from 'react'
import { Page } from './Page'

const cardMainClass = 'grid min-h-screen place-items-center p-6'
const cardSectionClass = 'w-full max-w-md rounded-2xl bg-white p-8 shadow-card ring-1 ring-slate-100'

export function Card({ children }: { children: ReactNode }) {
  return (
    <Page>
      <main className={cardMainClass}>
        <section className={cardSectionClass}>{children}</section>
      </main>
    </Page>
  )
}
