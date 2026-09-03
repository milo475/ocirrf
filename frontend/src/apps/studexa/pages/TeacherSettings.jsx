import { useState } from 'react'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { useAuth } from '../../../context/AuthContext'
import { api } from '../../../lib/api'
import { Card, Field, inputCls, Loading, LoadError, PageHead } from '../components/ui'
import { SCHOOL_LABEL, SCHOOL_TYPES } from '../lib/labels'
import { useApi } from '../lib/useApi'

/** Багшийн тохиргоо: код, сургуулийн төрөл; сурагчийн бүртгэлийн линк */
export default function TeacherSettings() {
  const { user } = useAuth()
  const { show } = useToast()
  const { data, error, loading, reload } = useApi('/studexa/me')
  const [schoolType, setSchoolType] = useState(null)
  const [saving, setSaving] = useState(false)
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const t = data.teacher
  const registerUrl = `${window.location.origin}/studexa/register?code=${encodeURIComponent(t?.code ?? '')}`

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api('/studexa/teacher', { method: 'PATCH', body: { schoolType: schoolType ?? t.schoolType } })
      show('Хадгалагдлаа')
      reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <PageHead title="Багшийн тохиргоо" sub={user?.name} />
      <Card title="Багшийн код">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-mono text-3xl tracking-widest border border-rule rounded px-5 py-2 bg-bg">{t?.code}</span>
          <div className="text-sm text-ink-muted">
            <p>Сурагчид энэ кодоор танд элсэх хүсэлт илгээнэ. Сургуулийн төрөл: <b>{SCHOOL_LABEL[t?.schoolType]}</b></p>
            <p className="mt-1">Бүртгэлийн линк: <code className="font-mono text-xs break-all">{registerUrl}</code></p>
            <Button variant="ghost" className="mt-2" onClick={() => navigator.clipboard?.writeText(registerUrl).then(() => show('Линк хуулагдлаа'))}>Линк хуулах</Button>
          </div>
        </div>
      </Card>
      <Card title="Сургуулийн төрөл">
        <form onSubmit={save} className="space-y-3">
          <Field label="Төрөл" hint="Их сургууль сонговол сурагчдын жагсаалтад төлбөрийн оронд оюутны код харагдана.">
            <select className={inputCls} value={schoolType ?? t?.schoolType} onChange={(e) => setSchoolType(e.target.value)}>
              {SCHOOL_TYPES.map(([k, v, icon]) => <option key={k} value={k}>{icon} {v}</option>)}
            </select>
          </Field>
          <Button type="submit" loading={saving}>Хадгалах</Button>
        </form>
      </Card>
      <Card title="Хувийн мэдээлэл, нууц үг, хэл">
        <p className="text-sm text-ink-muted">Нэр, и-мэйл, нууц үг, хэлний сонголт платформын <a className="underline underline-offset-2" href="/settings">Тохиргоо</a> хуудсанд байна.</p>
      </Card>
    </div>
  )
}
