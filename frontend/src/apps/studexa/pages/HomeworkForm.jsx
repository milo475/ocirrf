import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { apiUpload } from '../../../lib/api'
import { Card, Field, inputCls, Notice, PageHead } from '../components/ui'
import { useApi } from '../lib/useApi'

/** Даалгавар өгөх: бүгд / бүлэг / нэг сурагч, хугацаа, файл, линк */
export default function HomeworkForm() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [params] = useSearchParams()
  const preset = params.get('group') ?? ''
  const { data: students } = useApi('/studexa/students?limit=100')
  const { data: groups } = useApi('/studexa/groups')
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ target: preset ? `group:${preset}` : 'all', date: today, dueDate: today, title: '', link: '' })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const r = await apiUpload('/studexa/homework', { ...form, attachment: file ?? undefined })
      show(`${r.count} сурагчид даалгавар өгөгдлөө`)
      navigate(form.target.startsWith('group:') ? `/studexa/homework?group=${encodeURIComponent(form.target.slice(6))}` : '/studexa/homework')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <PageHead title="Даалгавар өгөх" />
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Card>
          <div className="space-y-4">
            <Field label="Сурагч">
              <select className={inputCls} value={form.target} onChange={set('target')}>
                <option value="all">👥 Бүгд (бүх сурагч)</option>
                {(groups?.cards ?? []).map((g) => <option key={g.group} value={`group:${g.group}`}>📁 Бүлэг: {g.group}</option>)}
                {(students?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.group ? ` (${s.group})` : ''}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Эхлэх огноо"><input type="date" className={inputCls} value={form.date} onChange={set('date')} required /></Field>
              <Field label="Дуусах огноо"><input type="date" className={inputCls} value={form.dueDate} onChange={set('dueDate')} required /></Field>
            </div>
            <Field label="Даалгавар">
              <textarea className={inputCls} rows={6} value={form.title} onChange={set('title')} required maxLength={4000} placeholder="Даалгаврын дэлгэрэнгүйг бичнэ үү. Хэдэн ч мөр бичиж болно..." />
            </Field>
            <Field label="Хавсралт (PDF, зураг — заавал биш, 10MB хүртэл)">
              <input type="file" accept=".pdf,image/*" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <Field label="Линк (заавал биш)"><input className={inputCls} value={form.link} onChange={set('link')} placeholder="https://..." /></Field>
          </div>
        </Card>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-2">
          <Button type="submit" loading={saving}>Хадгалах</Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>Болих</Button>
        </div>
      </form>
    </div>
  )
}
