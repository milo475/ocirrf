import Button from '../../../components/ui/Button'
import { Card, inputCls } from '../components/ui'
import { fmtDate, GENDER } from '../lib/labels'

/**
 * ДҮНГИЙН ХУУДАС (улирлын) — багшийн StudentDetail болон сурагчийн портал
 * хоёуланд нь ижил харагдана. `card` = GET .../report-card, `terms` =
 * улирлын жагсаалт (сонголт), `onTerm` = улирал солих.
 */
export default function ReportCard({ card, terms = [], term = '', onTerm, title = '📄 Дүнгийн хуудас' }) {
  if (!card) return null
  const s = card.student
  return (
    <Card
      title={title}
      action={
        <>
          {terms.length > 0 && onTerm && (
            <select className={`${inputCls} w-auto`} value={term} onChange={(e) => onTerm(e.target.value)}>
              <option value="">Одоогийн улирал</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.isCurrent ? '● ' : ''}{t.name}</option>)}
            </select>
          )}
          <Button variant="ghost" onClick={() => window.print()}>🖨 Хэвлэх</Button>
        </>
      }
    >
      <div className="text-sm">
        <div className="flex flex-wrap justify-between gap-2 border-b border-rule pb-3">
          <div>
            <p className="font-medium text-base">{s.name}{s.group ? ` · ${s.group}` : ''}</p>
            <p className="text-xs text-ink-muted">
              {s.registerNo ? `Регистр: ${s.registerNo} · ` : ''}{s.birthDate ? `Төрсөн: ${fmtDate(s.birthDate)} · ` : ''}{s.gender ? `${GENDER[s.gender]} · ` : ''}Багш: {card.teacherName || '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium">{card.term ? card.term.name : 'Бүх хугацаа'}</p>
            <p className="text-xs text-ink-muted">{card.term ? `${fmtDate(card.term.startDate)} – ${fmtDate(card.term.endDate)}` : 'Улирал тохируулаагүй'} · {fmtDate(card.generatedAt)}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Big label="Нийт дүн" value={card.percent === null ? '—' : `${card.percent}%`} sub={card.possible ? `${card.earned} / ${card.possible} оноо` : 'оноо тавигдаагүй'} />
          <Big label="Үнэлгээ" value={card.letter} />
          <Big label="Ирц" value={card.attendance.percent === null ? '—' : `${card.attendance.percent}%`} sub={`ирсэн ${card.attendance.present} · хоцорсон ${card.attendance.late} · тасалсан ${card.attendance.absent}`} />
          <Big label="Ангийн эрэмбэ" value={card.rank ? `${card.rank} / ${card.classSize}` : '—'} sub={card.homework.total ? `даалгавар ${card.homework.done}/${card.homework.total}` : undefined} />
        </div>

        {card.subjects.length === 0 ? (
          <p className="mt-4 text-ink-muted">Энэ улиралд дүнгийн багана байхгүй. Дүнгийн нэгтгэлд багана нэмээд улирал, хичээлийг нь сонгоно уу.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
                  <th className="text-left py-2 pr-3 font-normal">Хичээл</th>
                  <th className="text-left py-2 px-2 font-normal">Оноо (багана бүрээр)</th>
                  <th className="text-right py-2 px-2 font-normal">Нийт</th>
                  <th className="text-right py-2 px-2 font-normal">Хувь</th>
                  <th className="text-center py-2 pl-2 font-normal">Үнэлгээ</th>
                </tr>
              </thead>
              <tbody>
                {card.subjects.map((sub) => (
                  <tr key={sub.subject} className="border-b border-rule align-top">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">{sub.subject}</td>
                    <td className="py-2 px-2">
                      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {sub.rows.map((r) => (
                          <li key={r.column} className="whitespace-nowrap">
                            {r.column}: <span className="font-mono">{r.score === null ? '—' : `${r.score}/${r.max}`}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums whitespace-nowrap">{sub.possible ? `${sub.earned} / ${sub.possible}` : '—'}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{sub.percent === null ? '—' : `${sub.percent}%`}</td>
                    <td className="py-2 pl-2 text-center font-mono font-medium">{sub.letter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Үнэлгээний хуваарь: {card.scale.map((st) => `${st.label} ≥ ${st.min}%`).join(' · ')}
        </p>
      </div>
    </Card>
  )
}

function Big({ label, value, sub }) {
  return (
    <div className="border border-rule rounded p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 font-mono text-xl">{value}</p>
      {sub && <p className="text-xs text-ink-muted">{sub}</p>}
    </div>
  )
}
