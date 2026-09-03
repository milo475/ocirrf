import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, Field, inputCls, Loading, Notice, PageHead } from '../components/ui'
import { useApi } from '../lib/useApi'

const EMPTY = {
  name: '', group: '', studentCode: '', paymentStatus: 'PAID', phone: '',
  fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
}

/** Сурагч нэмэх / засах */
export default function StudentForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const { data: me } = useApi('/studexa/me')
  const { data: groups } = useApi('/studexa/groups')
  const [form, setForm] = useState({ ...EMPTY, group: params.get('group') ?? '' })
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const uni = me?.teacher?.schoolType === 'UNIVERSITY'

  useEffect(() => {
    if (!id) return
    api(`/studexa/students/${id}`)
      .then((d) => {
        const s = d.student
        setForm({
          name: s.name, group: s.group, studentCode: s.studentCode, paymentStatus: s.paymentStatus,
          phone: s.phone, fatherName: s.fatherName, fatherPhone: s.fatherPhone,
          motherName: s.motherName, motherPhone: s.motherPhone,
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const saved = await api(id ? `/studexa/students/${id}` : '/studexa/students', {
        method: id ? 'PATCH' : 'POST',
        body: form,
      })
      show('Хадгалагдлаа')
      const preset = params.get('group')
      if (!id && preset && saved.group === preset) navigate(`/studexa/groups/${encodeURIComponent(preset)}`)
      else navigate(`/studexa/students/${saved.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="max-w-2xl">
      <PageHead title={id ? `${form.name} — Засах` : 'Сурагч нэмэх'} />
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Нэр">
              <input className={inputCls} value={form.name} onChange={set('name')} required maxLength={100} />
            </Field>
            <Field label="Бүлэг" hint="Байгаа бүлгээс сонгох эсвэл шинэ нэр бичнэ">
              <input className={inputCls} list="sx-groups" value={form.group} onChange={set('group')} maxLength={100} placeholder="ж: 10а" />
              <datalist id="sx-groups">
                {(groups?.names ?? []).map((g) => <option key={g} value={g} />)}
              </datalist>
            </Field>
            {uni && (
              <Field label="Оюутны код">
                <input className={inputCls} value={form.studentCode} onChange={set('studentCode')} maxLength={30} />
              </Field>
            )}
            {!uni && (
              <Field label="Төлбөр">
                <select className={inputCls} value={form.paymentStatus} onChange={set('paymentStatus')}>
                  <option value="PAID">Төлсөн</option>
                  <option value="OVERDUE">Хоцорсон</option>
                </select>
              </Field>
            )}
            <Field label="Утас">
              <input className={inputCls} value={form.phone} onChange={set('phone')} maxLength={20} />
            </Field>
          </div>
        </Card>
        <Card title="Эцэг эхийн мэдээлэл">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Аавын нэр"><input className={inputCls} value={form.fatherName} onChange={set('fatherName')} maxLength={100} /></Field>
            <Field label="Аавын утасны дугаар"><input className={inputCls} value={form.fatherPhone} onChange={set('fatherPhone')} maxLength={20} /></Field>
            <Field label="Ээжийн нэр"><input className={inputCls} value={form.motherName} onChange={set('motherName')} maxLength={100} /></Field>
            <Field label="Ээжийн утасны дугаар"><input className={inputCls} value={form.motherPhone} onChange={set('motherPhone')} maxLength={20} /></Field>
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
