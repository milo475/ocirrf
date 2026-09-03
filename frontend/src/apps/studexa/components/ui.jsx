import { Link } from 'react-router'
import Spinner from '../../../components/ui/Spinner'
import EmptyState from '../../../components/ui/EmptyState'
import Button from '../../../components/ui/Button'

/** Хуудасны гарчиг + баруун талын үйлдлүүд */
export function PageHead({ title, sub, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-medium">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`bg-surface border border-rule rounded-lg p-5 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          {title && <h2 className="font-medium">{title}</h2>}
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, tone = '', to, sub }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-2 font-serif text-3xl font-medium tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </>
  )
  const cls = 'block bg-surface border border-rule rounded-lg p-5 hover:border-ink-muted transition-colors'
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function Pill({ item, children }) {
  return (
    <span
      className={`inline-flex items-center font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${
        item?.cls ?? 'text-ink-muted border-rule bg-surface'
      }`}
    >
      {item?.label ?? children}
    </span>
  )
}

export function Loading() {
  return (
    <div className="py-16 text-center">
      <Spinner size={22} />
    </div>
  )
}

export function LoadError({ error, onRetry }) {
  return (
    <EmptyState
      title="Ачаалж чадсангүй"
      note={error?.message}
      action={onRetry && <Button onClick={onRetry}>Дахин оролдох</Button>}
    />
  )
}

export function Notice({ tone = 'ok', children }) {
  const cls =
    tone === 'error'
      ? 'border-alarm/60 text-alarm bg-alarm/10'
      : 'border-safe/50 text-safe bg-safe/10'
  return <div className={`border rounded px-3 py-2 text-sm ${cls}`}>{children}</div>
}

/** Tab bar (бүлгээр шүүх г.м.) */
export function Tabs({ items, value, onChange }) {
  return (
    <div className="flex gap-1 flex-wrap border-b border-rule pb-3">
      {items.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
            value === key ? 'bg-surface text-ink border border-rule' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export const inputCls =
  'w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted'

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}
