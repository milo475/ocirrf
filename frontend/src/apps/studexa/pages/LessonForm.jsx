import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, Field, inputCls, Loading, Notice, PageHead } from '../components/ui'
import { LESSON_COLORS, WEEKDAYS } from '../lib/labels'
import { useApi } from '../lib/useApi'

/** Хичээл нэмэх / засах / устгах */
export default function LessonForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const { data: groups } = useApi('/studexa/groups')
  const [form, setForm] = useState({ title: '', group: params.get('group') ?? '', weekday: 0, startTime: '09:00', endTime: '10:30', color: 'indigo' })
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [del, setDel] = useState(false)

  useEffect(() => {
    if (!id) return
    api(`/studexa/lessons/${id}`)
      .then((l) => setForm({ title: l.title, group: l.group, weekday: l.weekday, startTime: l.startTime, endTime: l.endTime, color: l.color }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api(id ? `/studexa/lessons/${id}` : '/studexa/lessons', { method: id ? 'PATCH' : 'POST', body: { ...form, weekday: Number(form.weekday) } })
      show('Хадгалагдлаа')
      navigate(form.group ? `/studexa/schedule?group=${encodeURIComponent(form.group)}` : '/studexa/schedule')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />
  const names = groups?.names ?? []
  if (form.group && !names.includes(form.group)) names.push(form.group)

  return (
    <div className="max-w-xl">
      <PageHead title={id ? `${form.title} — Засах` : 'Хичээл нэмэх'} />
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Card>
          <div className="space-y-4">
            <Field label="Хичээл"><input className={inputCls} value={form.title} onChange={set('title')} required maxLength={100} /></Field>
            <Field label="Бүлэг" hint="Сурагчийн тоо бүлгээс автоматаар тоологдоно">
              <select className={inputCls} value={form.group} onChange={set('group')}>
                <option value="">👥 Бүх бүлэгт</option>
                {names.map((g) => <option key={g} value={g}>📁 {g}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Гараг">
                <select className={inputCls} value={form.weekday} onChange={set('weekday')}>
                  {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                </select>
              </Field>
              <Field label="Эхлэх"><input type="time" className={inputCls} value={form.startTime} onChange={set('startTime')} required /></Field>
              <Field label="Дуусах"><input type="time" className={inputCls} value={form.endTime} onChange={set('endTime')} required /></Field>
            </div>
            <Field label="Өнгө">
              <select className={inputCls} value={form.color} onChange={set('color')}>
                {LESSON_COLORS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <p className="text-xs text-ink-muted">Хичээлийн цаг 07:00–23:00 хооронд байх ёстой.</p>
          </div>
        </Card>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-2">
          <Button type="submit" loading={saving}>Хадгалах</Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>Болих</Button>
          {id && <Button variant="danger" className="ml-auto" onClick={() => setDel(true)}>🗑 Устгах</Button>}
        </div>
      </form>
      <ConfirmDialog open={del} title="Хичээл устгах" message={`${form.title} (${WEEKDAYS[form.weekday]}, ${form.startTime}–${form.endTime}) хичээлийг устгах уу?`} danger confirmLabel="Тийм, устгах"
        onConfirm={async () => { await api(`/studexa/lessons/${id}`, { method: 'DELETE' }); navigate('/studexa/schedule') }} onCancel={() => setDel(false)} />
    </div>
  )
}
