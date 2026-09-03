import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, inputCls, Loading, LoadError, PageHead, Pill, Tabs } from '../components/ui'
import { fmtDate, fmtDateTime, HW_STATUS } from '../lib/labels'
import { useApi } from '../lib/useApi'

/** Гэрийн даалгавар — Teams маягийн багц: нэг даалгавар, доор нь сурагч бүр */
export default function Homework() {
  const { show } = useToast()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const group = params.get('group') ?? ''
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (group) qs.set('group', group)
  const { data, error, loading, reload } = useApi(`/studexa/homework?${qs}`)
  const [grades, setGrades] = useState({})

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  async function grade(hw) {
    const g = grades[hw.id] ?? {}
    try {
      const r = await api(`/studexa/homework/${hw.id}/grade`, {
        method: 'POST',
        body: { score: g.score ?? (hw.score === null ? '' : String(hw.score)), maxScore: g.max ?? String(hw.gradeColumn?.maxScore ?? 20) },
      })
      show(r.score === null ? 'Оноо хоослогдлоо' : `${r.score}/${r.maxScore} оноо хадгалагдлаа`)
      reload()
    } catch (e) {
      show(e.message, { type: 'error' })
    }
  }

  async function setStatus(hw, s) {
    await api(`/studexa/homework/${hw.id}/status`, { method: 'PATCH', body: { status: s } }).catch((e) => show(e.message, { type: 'error' }))
    reload()
  }

  async function remove(hw) {
    await api(`/studexa/homework/${hw.id}`, { method: 'DELETE' }).catch((e) => show(e.message, { type: 'error' }))
    reload()
  }

  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const gq = group ? `?group=${encodeURIComponent(group)}` : ''

  return (
    <div className="space-y-5">
      <PageHead
        title="Гэрийн даалгавар"
        actions={<Link className="bg-ink text-bg rounded px-4 py-2 text-sm font-medium" to={`/studexa/homework/new${gq}`}>+ Даалгавар өгөх{group ? ` (${group})` : ''}</Link>}
      />
      {data.groups.length > 0 && (
        <Tabs items={[['', '👥 Бүх бүлэг'], ...data.groups.map((g) => [g, `📁 ${g}`])]} value={group} onChange={(v) => setParam('group', v)} />
      )}
      <div className="flex items-center gap-2">
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">Бүх даалгавар</option>
          <option value="open">Хүлээгдэж буй (нийт)</option>
          <option value="PENDING">Хүлээгдэж буй</option>
          <option value="IN_PROGRESS">Хийж буй</option>
          <option value="DONE">Хийсэн</option>
        </select>
      </div>

      {data.assignments.length === 0 && (
        <Card><p className="text-sm text-ink-muted">Даалгавар алга. «+ Даалгавар өгөх» товчоор эхний даалгавраа өгөөрэй.</p></Card>
      )}
      {data.assignments.map((a, i) => (
        <details key={a.key} open={i === 0} className="bg-surface border border-rule rounded-lg">
          <summary className="cursor-pointer p-4 flex flex-wrap items-center gap-3">
            <span className="text-xl">📘</span>
            <span className="flex-1 min-w-48">
              <span className="block font-medium truncate">{a.title.split('\n')[0]}</span>
              <span className="block text-xs text-ink-muted">
                {fmtDate(a.date)}{a.dueDate ? ` → ${fmtDate(a.dueDate)}` : ''}{a.overdue ? ' ⚠ хугацаа хэтэрсэн' : ''}
                {a.attachmentUrl ? ' · 📎' : ''}{a.link ? ' · 🔗' : ''}{a.gradeColumn ? ` · 📊 ${a.gradeColumn.name} (/${a.gradeColumn.maxScore})` : ''}
              </span>
            </span>
            <span className="flex gap-1.5 text-[11px] font-mono uppercase">
              <Pill>{a.total} сурагч</Pill>
              <Pill item={{ label: `📤 ${a.submitted}/${a.total}`, cls: a.submitted === a.total ? 'text-safe border-safe/40 bg-safe/12' : 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' }} />
              <Pill item={{ label: `✅ ${a.graded}/${a.total} оноотой`, cls: a.graded === a.total ? 'text-safe border-safe/40 bg-safe/12' : 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' }} />
            </span>
          </summary>
          <div className="border-t border-rule p-4 space-y-3">
            <p className="text-sm whitespace-pre-wrap">{a.title}</p>
            {(a.attachmentUrl || a.link) && (
              <div className="flex gap-2">
                {a.attachmentUrl && <FileLink url={a.attachmentUrl} label="📎 Хавсралт үзэх" />}
                {a.link && <a className="border border-rule rounded px-3 py-1.5 text-sm hover:border-ink-muted" href={a.link} target="_blank" rel="noopener">🔗 Линк нээх</a>}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
                    <th className="text-left py-2 pr-2 font-normal">Сурагч</th>
                    <th className="text-left py-2 px-2 font-normal">Илгээсэн ажил</th>
                    <th className="text-left py-2 px-2 font-normal">Оноо</th>
                    <th className="text-left py-2 px-2 font-normal">Төлөв</th>
                    <th className="py-2 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {a.items.map((hw) => (
                    <tr key={hw.id} className="border-b border-rule align-top">
                      <td className="py-2 pr-2"><Link className="hover:text-accent" to={`/studexa/students/${hw.student.id}`}>{hw.student.name}</Link></td>
                      <td className="py-2 px-2">
                        {hw.submission ? (
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap gap-2 items-center">
                              {hw.submission.fileUrl && <FileLink url={hw.submission.fileUrl} label="📥 Файл" small />}
                              {hw.submission.link && <a className="underline underline-offset-2" href={hw.submission.link} target="_blank" rel="noopener">🔗 Линк</a>}
                              <span className="text-xs text-ink-muted">{fmtDateTime(hw.submission.submittedAt)}</span>
                            </div>
                            {hw.submission.comment && <p className="text-xs text-ink-muted whitespace-pre-wrap">💬 {hw.submission.comment}</p>}
                          </div>
                        ) : (
                          <span className="text-ink-muted">Илгээгээгүй</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); grade(hw) }} title="Авсан оноо / дээд оноо (ж: 16 / 20)">
                          <input type="number" min={0} max={1000} className={`${inputCls} py-1 w-16`} placeholder="оноо" value={grades[hw.id]?.score ?? (hw.score === null ? '' : hw.score)} onChange={(e) => setGrades({ ...grades, [hw.id]: { ...grades[hw.id], score: e.target.value } })} />
                          <span className="text-ink-muted">/</span>
                          <input type="number" min={1} max={1000} className={`${inputCls} py-1 w-16`} value={grades[hw.id]?.max ?? (hw.gradeColumn?.maxScore ?? 20)} onChange={(e) => setGrades({ ...grades, [hw.id]: { ...grades[hw.id], max: e.target.value } })} />
                          <Button type="submit" variant="ghost" title="Хадгалах — дүнгийн нэгтгэлд орно">✓</Button>
                        </form>
                      </td>
                      <td className="py-2 px-2">
                        <select className={`${inputCls} py-1 w-auto`} value={hw.status} onChange={(e) => setStatus(hw, e.target.value)}>
                          {Object.entries(HW_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <button type="button" className="text-ink-muted hover:text-alarm" title="Энэ сурагчийн даалгаврыг устгах" onClick={() => remove(hw)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}

/** Эрхийн хамгаалалттай файл — auth header-тэй татаж blob-оор нээнэ */
export function FileLink({ url, label, small = false }) {
  const { show } = useToast()
  async function open() {
    try {
      const { apiBlob } = await import('../../../lib/api')
      const { blob } = await apiBlob(url.replace(/^\/api/, ''))
      const obj = URL.createObjectURL(blob)
      window.open(obj, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(obj), 60_000)
    } catch (e) {
      show(e.message, { type: 'error' })
    }
  }
  return (
    <button type="button" onClick={open} className={small ? 'underline underline-offset-2' : 'border border-rule rounded px-3 py-1.5 text-sm hover:border-ink-muted'}>
      {label}
    </button>
  )
}
