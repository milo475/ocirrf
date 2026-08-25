/** Хоосон жагсаалтын төлөв */
export default function EmptyState({ title = 'Юу ч алга', note, action }) {
  return (
    <div className="border border-dashed border-rule rounded-lg py-16 text-center">
      <p className="font-serif text-xl text-ink-muted">{title}</p>
      {note && <p className="mt-2 text-sm text-ink-muted">{note}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
