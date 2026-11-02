const spinnerContainerClass = 'grid min-h-screen place-items-center'
const spinnerIconClass = 'h-6 w-6 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-500'

export function Spinner() {
  return (
    <div role="status" aria-label="Loading" className={spinnerContainerClass}>
      <span className={spinnerIconClass} />
    </div>
  )
}
