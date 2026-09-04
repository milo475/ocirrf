import { Link } from 'react-router'

/** Ангийн нэгтгэл — Ирц, Даалгавар, багшийн баганууд, Нийт оноо */
export default function ClassTable({ table }) {
  if (!table || table.rows.length === 0) {
    return <p className="text-sm text-ink-muted">Сурагч алга.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
            <th className="text-left py-2 pr-3 font-normal">Сурагчийн нэр</th>
            <th className="text-right py-2 px-2 font-normal">Ирц</th>
            <th className="text-right py-2 px-2 font-normal">Даалгавар</th>
            {table.colLabels.map((l) => (
              <th key={l} className="text-right py-2 px-2 font-normal whitespace-nowrap">
                {l}
              </th>
            ))}
            <th className="text-right py-2 pl-2 font-normal whitespace-nowrap">Нийт оноо</th>
            <th className="text-center py-2 pl-2 font-normal" title="Үнэлгээний хуваарь: Хичээл · Улирал хуудас">Үнэлгээ</th>
            <th className="text-right py-2 pl-2 font-normal">Эрэмбэ</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.student.id} className="border-b border-rule">
              <td className="py-2 pr-3">
                <Link className="underline underline-offset-2 hover:text-accent" to={`/studexa/students/${r.student.id}`}>
                  {r.student.name}
                </Link>
              </td>
              <td className="py-2 px-2 text-right font-mono tabular-nums">{r.att}</td>
              <td className="py-2 px-2 text-right font-mono tabular-nums">{r.hw}</td>
              {r.cells.map((c, i) => (
                <td key={i} className="py-2 px-2 text-right font-mono tabular-nums">
                  {c === '' ? '' : c}
                </td>
              ))}
              <td className="py-2 pl-2 text-right font-mono tabular-nums whitespace-nowrap">{r.grandLabel}</td>
              <td className="py-2 pl-2 text-center font-mono font-medium">{r.letter ?? '—'}</td>
              <td className="py-2 pl-2 text-right font-mono tabular-nums">{r.rank ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
