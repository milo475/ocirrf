const OPTIONS = [
  { value: 'combined', label: 'Нэгтгэсэн' },
  { value: 'segment', label: 'Категориор' },
]

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex border border-rule rounded overflow-hidden">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-sm transition-colors ${
            value === o.value
              ? 'bg-surface text-ink'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
