import type { ButtonHTMLAttributes } from 'react'

const buttonBaseClass =
  'inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'

const buttonVariants = {
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
  secondary: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-slate-100',
} as const

const buttonFullWidthClass = 'w-full'

export type ButtonVariant = keyof typeof buttonVariants

type ButtonProps = { variant?: ButtonVariant; fullWidth?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ variant = 'primary', fullWidth = true, ...rest }: ButtonProps) {
  return <button className={`${buttonBaseClass} ${fullWidth ? buttonFullWidthClass : ''} ${buttonVariants[variant]}`} {...rest} />
}
