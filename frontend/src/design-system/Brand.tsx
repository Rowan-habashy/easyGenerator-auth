import { Link } from 'react-router-dom'

const brandLinkClass = 'inline-flex items-center gap-2 font-bold text-slate-900'
const brandBadgeClass = 'grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white'

export function Brand() {
  return (
    <Link to="/" className={brandLinkClass}>
      <span className={brandBadgeClass}>e</span>
      easyGenerator
    </Link>
  )
}
