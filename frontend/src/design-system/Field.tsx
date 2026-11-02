import type { InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'

const fieldContainerClass = 'mb-4 flex flex-col gap-1.5'
const fieldLabelClass = 'text-sm font-semibold text-slate-700'
const fieldInputClass =
  'rounded-xl border border-slate-200 px-3.5 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 aria-[invalid=true]:border-rose-500'
const fieldErrorClass = 'text-sm text-rose-600'

type FieldProps = { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, id, ...input }, ref) {
  return (
    <div className={fieldContainerClass}>
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <input id={id} ref={ref} aria-invalid={!!error} className={fieldInputClass} {...input} />
      {error && <span className={fieldErrorClass}>{error}</span>}
    </div>
  )
})
