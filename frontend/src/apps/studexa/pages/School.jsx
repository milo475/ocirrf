import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, Field, inputCls, Loading, LoadError, PageHead, Pill } from '../components/ui'
import { useApi } from '../lib/useApi'

/**
 * НЭГДСЭН АНГИ — сургуулийн түвшний ангиуд. Удирдлага (studexa.manage) бүх
 * ангийг үүсгэж/засна; багш өөрийн заадаг ангиудаа харна, ангийн багш нь
 * сурагчдаа удирдана.
 */
export default function School() {
  const { show } = useToast()
  const { data, error, loading, reload } = useApi('/studexa/school/classes')
  const { data: teachers } = useApi('/studexa/school/teachers')
  const [form, setForm] = useState({ name: '', grade: '', homeroomTeacherId: '' })
  const [saving, setSaving] = useState(false)
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  async function create(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api('/studexa/school/classes', {
        method: 'POST',
        body: { name: form.name, grade: form.grade ? Number(form.grade) : undefined, homeroomTeacherId: form.homeroomTeacherId || undefined },
      })
      show('Анги үүслээ')
      setForm({ name: '', grade: '', homeroomTeacherId: '' })
      reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="Сургууль · Ангиуд"
        sub={data.canManage ? 'Байгууллагын ангиуд — олон багш хуваалцана; багш бүрд ангийн нэртэй бүлэг, сурагчид автоматаар үүснэ' : 'Таны заадаг ангиуд (ангийн багш бол сурагчдаа удирдана)'}
      />
      {data.canManage && (
        <Card title="➕ Анги үүсгэх">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-4">
            <Field label="Ангийн нэр"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ж: 10а" required maxLength={100} /></Field>
            <Field label="Анги (дугаар)"><input type="number" min={1} max={12} className={inputCls} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="10" /></Field>
            <Field label="Ангийн багш">
              <select className={inputCls} value={form.homeroomTeacherId} onChange={(e) => setForm({ ...form, homeroomTeacherId: e.target.value })}>
                <option value="">— Дараа сонгоно —</option>
                {(teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
              </select>
            </Field>
            <div className="flex items-end"><Button type="submit" loading={saving}>Үүсгэх</Button></div>
          </form>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((c) => (
          <Link key={c.id} to={`/studexa/school/classes/${c.id}`} className="bg-surface border border-rule rounded-lg p-4 hover:border-ink-muted">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xl">🏫</p>
              {c.isHomeroom && <Pill item={{ label: 'Миний анги', cls: 'text-safe border-safe/40 bg-safe/12' }} />}
            </div>
            <p className="mt-1 font-medium text-lg">{c.name}{c.grade ? <span className="text-xs text-ink-muted font-normal"> · {c.grade}-р анги</span> : ''}</p>
            <p className="text-xs text-ink-muted">Ангийн багш: {c.homeroomTeacher?.name ?? '—'}</p>
            <p className="mt-2 text-xs text-ink-muted font-mono">{c.pupils} сурагч · {c.teachers} багш</p>
          </Link>
        ))}
        {data.items.length === 0 && (
          <p className="text-sm text-ink-muted col-span-full">
            {data.canManage ? 'Анги үүсгээгүй байна. Анги үүсгээд багш нар, сурагчдаа оруулбал багш бүрийн «Сурагчид» хуудсанд тэр анги бүлэг болж гарна.' : 'Танд оноосон анги алга. Сургуулийн удирдлага таныг ангид оноосны дараа энд харагдана.'}
          </p>
        )}
      </div>
      <p className="text-xs text-ink-muted">Нэгдсэн анги: сурагчийн мастер бүртгэл нэг л удаа хийгдэж, ангийн багш бүрийн жагсаалтад автоматаар орно. Багш бүр өөрийн ирц, дүн, даалгавраа хэвээр хөтөлнө; сурагчийн нэгдсэн дүнгийн хуудас бүх багшийн дүнг нэгтгэнэ.</p>
    </div>
  )
}
