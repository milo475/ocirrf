/** Нэг сурагчийн дүнгийн хүснэгт (багана бүр нэг мөр, огноогоор багана) */
export default function ScoreTable({ table }) {
  if (!table) {
    return <p className="text-sm text-ink-muted">Дүн бүртгэгдээгүй байна.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
            <th className="text-left py-2 pr-3 font-normal">Багана</th>
            {table.dates.map((d) => (
              <th key={d} className="text-right py-2 px-2 font-normal font-mono">
                {d.slice(5).replace('-', '.')}
              </th>
            ))}
            <th className="text-right py-2 px-2 font-normal">Оноо</th>
            <th className="text-right py-2 pl-2 font-normal">Хувь</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.label} className="border-b border-rule">
              <td className="py-2 pr-3">{r.label}</td>
              {r.cells.map((c, i) => (
                <td key={i} className="py-2 px-2 text-right font-mono tabular-nums">
                  {c}
                </td>
              ))}
              <td className="py-2 px-2 text-right font-mono tabular-nums">{r.total}</td>
              <td className="py-2 pl-2 text-right font-mono tabular-nums">{r.percent}</td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="py-2 pr-3" colSpan={table.dates.length + 1}>
              Нийт дүн
            </td>
            <td className="py-2 px-2 text-right font-mono tabular-nums" colSpan={2}>
              {table.totalLabel} ({table.percent}%)
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-muted">
        «Оноо» = авсан оноо / тухайн ажлын дээд оноо. Нийт дүн = авсан оноонуудын нийлбэр / оноо
        тавигдсан багануудын дээд онооны нийлбэр.
      </p>
    </div>
  )
}
