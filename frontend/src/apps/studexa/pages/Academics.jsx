import { useState } from 'react'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, Field, inputCls, Loading, LoadError, PageHead, Pill } from '../components/ui'
import { fmtDate, LESSON_COLORS, LESSON_COLOR_STYLE, localDateStr } from '../lib/labels'
import { useApi } from '../lib/useApi'

/**
 * ХИЧЭЭЛ · УЛИРАЛ · ҮНЭЛГЭЭ — сургууль бүрт байдаг суурь тохиргоо:
 *  - Хичээл (судлагдахуун): хуваарийн хичээл, дүнгийн багана үүгээр бүлэглэгдэж
 *    дүнгийн хуудсанд хичээл бүрээр дүн гарна
 *  - Улирал: дүнгийн багана улиралд хамаарна; дүнгийн хуудас, ирц улирлаар
 *  - Үнэлгээний хуваарь: хувь → үсгэн үнэлгээ (default A/B/C/D/F 90/80/70/60)
 */
export default function Academics() {
  return (
    <div className="space-y-6">
      <PageHead title="Хичээл · Улирал · Үнэлгээ" sub="Дүнгийн хуудас, хуваарь, нэгтгэлийн суурь тохиргоо" />
      <div className="grid gap-4 lg:grid-cols-2">
        <SubjectsCard />
        <TermsCard />
      </div>
      <ScaleCard />
    </div>
  )
}

function SubjectsCard() {
  const { show } = useToast()
  const { data, error, loading, reload } = useApi('/studexa/subjects')
  const [name, setName] = useState('')
  const [color, setColor] = useState('indigo')
  const [del, setDel] = useState(null)
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  async function add(e) {
    e.preventDefault()
    try {
      await api('/studexa/subjects', { method: 'POST', body: { name, color } })
      setName('')
      reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    }
  }

  return (
    <Card title="📚 Хичээлүүд (судлагдахуун)">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input className={`${inputCls} flex-1 min-w-40`} value={name} onChange={(e) => setName(e.target.value)} placeholder="ж: Математик" required maxLength={100} />
        <select className={`${inputCls} w-auto`} value={color} onChange={(e) => setColor(e.target.value)}>
          {LESSON_COLORS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button type="submit">+ Нэмэх</Button>
      </form>
      <ul className="mt-3 divide-y divide-rule text-sm">
        {data.map((s) => (
          <li key={s.id} className="py-2 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full border" style={LESSON_COLOR_STYLE[s.color]} />
            <span className="flex-1 font-medium">{s.name}</span>
            <span className="text-xs text-ink-muted">{s._count.lessons} хуваарь · {s._count.columns} багана</span>
            <button type="button" className="text-ink-muted hover:text-alarm" onClick={() => setDel(s)}>✕</button>
          </li>
        ))}
        {data.length === 0 && <li className="py-2 text-ink-muted">Хичээл бүртгээгүй. Нэмсний дараа хуваарь болон дүнгийн баганад хичээл сонгож болно.</li>}
      </ul>
      <ConfirmDialog open={Boolean(del)} title="Хичээл устгах" message={del ? `«${del.name}» хичээлийг устгах уу? Хуваарь, багана устахгүй — зөвхөн хичээлгүй болно.` : ''} danger confirmLabel="Устгах"
        onConfirm={async () => { await api(`/studexa/subjects/${del.id}`, { method: 'DELETE' }).catch((e) => show(e.message, { type: 'error' })); setDel(null); reload() }} onCancel={() => setDel(null)} />
    </Card>
  )
}

function TermsCard() {
  const { show } = useToast()
  const { data, error, loading, reload } = useApi('/studexa/terms')
  const [form, setForm] = useState({ name: '', startDate: localDateStr(), endDate: localDateStr() })
  const [del, setDel] = useState(null)
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function add(e) {
    e.preventDefault()
    try {
      await api('/studexa/terms', { method: 'POST', body: form })
      setForm({ ...form, name: '' })
      reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    }
  }

  return (
    <Card title="📅 Улирал / хичээлийн жил">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-4">
        <input className={inputCls} value={form.name} onChange={set('name')} placeholder="ж: 2026-2027 I улирал" required maxLength={100} />
        <input type="date" className={inputCls} value={form.startDate} onChange={set('startDate')} required />
        <input type="date" className={inputCls} value={form.endDate} onChange={set('endDate')} required />
        <Button type="submit">+ Нэмэх</Button>
      </form>
      <ul className="mt-3 divide-y divide-rule text-sm">
        {data.map((t) => (
          <li key={t.id} className="py-2 flex flex-wrap items-center gap-3">
            <span className="flex-1 min-w-40">
              <b>{t.name}</b>{' '}
              {t.isCurrent && <Pill item={{ label: 'Одоогийн', cls: 'text-safe border-safe/40 bg-safe/12' }} />}
              <span className="block text-xs text-ink-muted font-mono">{fmtDate(t.startDate)} – {fmtDate(t.endDate)} · {t._count.columns} багана</span>
            </span>
            {!t.isCurrent && <Button variant="ghost" onClick={() => api(`/studexa/terms/${t.id}/current`, { method: 'POST' }).then(reload).catch((e) => show(e.message, { type: 'error' }))}>Одоогийн болгох</Button>}
            <button type="button" className="text-ink-muted hover:text-alarm" onClick={() => setDel(t)}>✕</button>
          </li>
        ))}
        {data.length === 0 && <li className="py-2 text-ink-muted">Улирал бүртгээгүй. Улирал нэмсний дараа дүнгийн багана улиралд хамаарч, дүнгийн хуудас улирлаар гарна.</li>}
      </ul>
      <ConfirmDialog open={Boolean(del)} title="Улирал устгах" message={del ? `«${del.name}» улирлыг устгах уу? Баганууд устахгүй — улиралгүй болно.` : ''} danger confirmLabel="Устгах"
        onConfirm={async () => { await api(`/studexa/terms/${del.id}`, { method: 'DELETE' }).catch((e) => show(e.message, { type: 'error' })); setDel(null); reload() }} onCancel={() => setDel(null)} />
    </Card>
  )
}

function ScaleCard() {
  const { show } = useToast()
  const { data, error, loading, reload } = useApi('/studexa/grading-scale')
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  return <ScaleEditor key={JSON.stringify(data.scale)} data={data} reload={reload} show={show} />
}

function ScaleEditor({ data, reload, show }) {
  const [rows, setRows] = useState(data.scale)
  const [saving, setSaving] = useState(false)
  const edit = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  async function save() {
    setSaving(true)
    try {
      await api('/studexa/grading-scale', { method: 'POST', body: { scale: rows.map((r) => ({ min: Number(r.min), label: r.label })) } })
      show('Үнэлгээний хуваарь хадгалагдлаа')
      reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title="🅰 Үнэлгээний хуваарь (хувь → үсгэн үнэлгээ)"
      action={!data.isDefault && <Button variant="ghost" onClick={() => api('/studexa/grading-scale', { method: 'DELETE' }).then(reload)}>Default руу буцаах</Button>}
    >
      <p className="text-sm text-ink-muted">Нийт хувь энэ шатнаас ≥ бол тухайн үнэлгээ. {data.isDefault ? 'Одоо ЕБС-ийн default (A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F) ажиллаж байна.' : 'Өөрийн хуваарь ажиллаж байна.'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1 border border-rule rounded px-2 py-1">
            <input className={`${inputCls} py-0.5 w-16`} value={r.label} maxLength={8} onChange={(e) => edit(i, 'label', e.target.value)} />
            <span className="text-xs text-ink-muted">≥</span>
            <input type="number" min={0} max={100} className={`${inputCls} py-0.5 w-16`} value={r.min} onChange={(e) => edit(i, 'min', e.target.value)} />
            <span className="text-xs text-ink-muted">%</span>
            {rows.length > 1 && <button type="button" className="text-ink-muted hover:text-alarm ml-1" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        {rows.length < 12 && <Button variant="ghost" onClick={() => setRows([...rows, { min: 0, label: '' }])}>+ Шат</Button>}
      </div>
      <div className="mt-3 flex gap-2 items-center">
        <Button onClick={save} loading={saving}>Хадгалах</Button>
        <Field label="" hint="Жишээ: Монголын 8 баллын систем — VIII ≥ 97, VII ≥ 90, VI ≥ 80, V ≥ 70, IV ≥ 60, III ≥ 50, II ≥ 30, I" />
      </div>
    </Card>
  )
}
