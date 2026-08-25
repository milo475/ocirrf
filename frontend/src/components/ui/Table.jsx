import { useLang } from '../../context/LanguageContext'
import EmptyState from './EmptyState'

/**
 * Ерөнхий хүснэгт + pagination.
 * columns: [{ key, header, align ('left'|'right'), render?(row) }]
 * Тоон багануудад font-mono tabular-nums хэрэглэнэ (render дотроо).
 */
export default function Table({
  columns,
  rows,
  rowKey = (row) => row.id,
  onRowClick,
  page = 1,
  limit = 20,
  total = 0,
  onPageChange,
  empty = 'Мэдээлэл алга',
}) {
  const { t } = useLang()
  const pages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  if (rows.length === 0) {
    return <EmptyState title={empty} />
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`font-normal py-2 px-3 first:pl-0 last:pr-0 ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-rule transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-surface' : ''
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`py-2.5 px-3 first:pl-0 last:pr-0 ${
                      c.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onPageChange && total > limit && (
        <div className="flex items-center justify-between mt-4">
          <p className="font-mono text-xs text-ink-muted tabular-nums">
            {t('table.range', { from, to, total })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="border border-rule rounded px-2.5 py-1 text-sm text-ink-muted hover:text-ink disabled:opacity-40"
            >
              ←
            </button>
            <span className="font-mono text-xs text-ink-muted px-2 tabular-nums">
              {page} / {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
              className="border border-rule rounded px-2.5 py-1 text-sm text-ink-muted hover:text-ink disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
