import Spinner from './Spinner'

const VARIANTS = {
  primary: 'bg-ink text-bg hover:opacity-90 disabled:opacity-50',
  ghost:
    'border border-rule text-ink-muted hover:text-ink hover:border-ink-muted disabled:opacity-50',
  danger: 'bg-alarm text-bg hover:opacity-90 disabled:opacity-50',
}

export default function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-opacity ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size={14} className="border-current border-t-transparent" />}
      {children}
    </button>
  )
}
