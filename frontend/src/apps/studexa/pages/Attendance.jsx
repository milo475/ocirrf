import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, inputCls, Loading, LoadError, Notice, PageHead, Tabs } from '../components/ui'
import { ATT_STATUS } from '../lib/labels'
import { downloadFile, useApi } from '../lib/useApi'

/** Ирц бүртгэх: өдөр + хичээл + бүлэг сонгоод сурагч бүрийн төлөв */
export default function Attendance() {
  const { show } = useToast()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? ''
  const lessonId = params.get('lesson') ?? ''
  const group = params.get('group') ?? ''
  const qs = new URLSearchParams()
  if (date) qs.set('date', date)
  if (lessonId) qs.set('lessonId', lessonId)
  if (group) qs.set('group', group)
  const { data, error, loading, reload } = useApi(`/studexa/attendance?${qs}`)
  const [saved, setSaved] = useState(null)

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  const exportQ = group ? `?group=${encodeURIComponent(group)}` : ''
  return (
    <div className="space-y-5">
      <PageHead
        title="Ирц бүртгэх"
        sub="Өдөр + хичээлээ сонгоод ирцийг тэмдэглэнэ — хичээл бүрд тусдаа бүртгэгдэнэ"
        actions={
          <>
            <Button variant="ghost" onClick={() => downloadFile(`/studexa/export/attendance.csv${exportQ}`, 'irts.csv').catch((e) => show(e.message, { type: 'error' }))}>⬇ CSV тайлан</Button>
            <Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to="/studexa/students">← Сурагчид</Link>
          </>
        }
      />
      {saved && <Notice>✓ {saved.day.replace(/-/g, '.')}-ний ирц хадгалагдлаа ({saved.saved} сурагч). Сурагчдын ирцийн хувь шинэчлэгдсэн.</Notice>}

      {data.groups.length > 0 && (
        <Tabs items={[['', '👥 Бүх бүлэг'], ...data.groups.map((g) => [g, `📁 ${g}`])]} value={group} onChange={(v) => setParam('group', v)} />
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input type="date" className={`${inputCls} w-auto`} value={data.day} onChange={(e) => setParam('date', e.target.value)} />
        <select className={`${inputCls} w-auto`} value={lessonId} onChange={(e) => setParam('lesson', e.target.value)}>
          <option value="">📋 Өдрийн ерөнхий ирц</option>
          {data.dayLessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}{l.group ? ` (${l.group})` : ''} — {l.startTime}
            </option>
          ))}
        </select>
      </div>

      {/* key: өдөр/хичээл/бүлэг солигдоход сонголт дахин эхэлнэ */}
      <AttendanceEditor
        key={`${data.day}|${data.lesson?.id ?? ''}|${data.group}`}
        data={data}
        onSaved={(r) => {
          setSaved(r)
          show(`${r.saved} сурагчийн ирц хадгалагдлаа`)
          reload()
        }}
      />
    </div>
  )
}

function AttendanceEditor({ data, onSaved }) {
  const { show } = useToast()
  const [statuses, setStatuses] = useState(() => {
    const init = {}
    for (const r of data.rows) if (r.status) init[r.student.id] = r.status
    return init
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const r = await api('/studexa/attendance', {
        method: 'POST',
        body: { date: data.day, lessonId: data.lesson?.id, group: data.group || undefined, statuses },
      })
      onSaved(r)
    } catch (e) {
      show(e.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div>
        <Button variant="ghost" onClick={() => { const all = {}; for (const r of data.rows) all[r.student.id] = 'PRESENT'; setStatuses(all) }}>Бүгдийг «Ирсэн» болгох</Button>
      </div>
      <Card>
        {data.rows.length === 0 ? (
          <p className="text-sm text-ink-muted">Сурагч алга.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {data.rows.map((r) => (
              <li key={r.student.id} className="py-2.5 flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-40">
                  <b>{r.student.name}</b>
                  <span className="ml-2 text-xs text-ink-muted">{r.student.group}</span>
                </span>
                <div className="flex gap-1">
                  {Object.entries(ATT_STATUS).map(([key, v]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatuses({ ...statuses, [r.student.id]: key })}
                      className={`border rounded px-3 py-1 text-xs font-mono uppercase tracking-wide transition-colors ${
                        statuses[r.student.id] === key ? v.cls : 'border-rule text-ink-muted hover:text-ink'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Button onClick={save} loading={saving} disabled={data.rows.length === 0}>Ирц хадгалах</Button>
    </>
  )
}
