/** Нэг категори сонгоход бусад нь бүдгэрнэ; дахин дарвал цуцлагдана */
export default function CategoryFilter({ categories, value, onChange }) {
  return (
    <div className="inline-flex items-center gap-1">
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(value === c ? null : c)}
          className={`px-2.5 py-1 rounded text-sm transition-colors ${
            value === c
              ? 'bg-surface text-ink border border-rule'
              : 'text-ink-muted hover:text-ink border border-transparent'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
