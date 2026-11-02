import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'
import { Link } from 'react-router-dom'

export function Spinner() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-screen place-items-center">
      <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-500" />
    </div>
  )
}

export function Brand() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 font-bold text-slate-900">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">e</span>
      easyGenerator
    </Link>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50">{children}</div>
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <Page>
      <main className="grid min-h-screen place-items-center p-6">
        <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card ring-1 ring-slate-100">{children}</section>
      </main>
    </Page>
  )
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
      {children}
    </div>
  )
}

type FieldProps = { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, id, ...input }, ref) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={!!error}
        className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 aria-[invalid=true]:border-rose-500"
        {...input}
      />
      {error && <span className="text-sm text-rose-600">{error}</span>}
    </div>
  )
})

const base = 'inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'
const variants = {
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
  secondary: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
}
type Variant = keyof typeof variants

export function Button({ variant = 'primary', fullWidth = true, ...rest }: { variant?: Variant; fullWidth?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${base} ${fullWidth ? 'w-full' : ''} ${variants[variant]}`} {...rest} />
}

export function LinkButton({ to, variant = 'primary', large, children }: { to: string; variant?: Variant; large?: boolean; children: ReactNode }) {
  return (
    <Link to={to} className={`${base} ${variants[variant]} ${large ? 'px-6 py-3.5 text-lg' : ''}`}>
      {children}
    </Link>
  )
}
