/** Label + алдааны мессежтэй текст оролт */
export default function Input({ label, error, id, className = '', ...rest }) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full bg-bg border rounded px-3 py-2 text-sm focus:outline-none transition-colors ${
          error ? 'border-alarm' : 'border-rule focus:border-ink-muted'
        }`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-alarm">{error}</p>}
    </div>
  )
}
