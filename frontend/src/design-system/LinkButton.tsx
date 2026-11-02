import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const buttonBaseClass =
  'inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'

const buttonVariants = {
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
  secondary: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
} as const

const buttonLargeClass = 'px-6 py-3.5 text-lg'

type ButtonVariant = keyof typeof buttonVariants

export function LinkButton({
  to,
  variant = 'primary',
  large,
  children,
}: {
  to: string
  variant?: ButtonVariant
  large?: boolean
  children: ReactNode
}) {
  return (
    <Link to={to} className={`${buttonBaseClass} ${buttonVariants[variant]} ${large ? buttonLargeClass : ''}`}>
      {children}
    </Link>
  )
}
