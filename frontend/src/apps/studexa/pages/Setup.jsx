import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, Field, inputCls, Notice, PageHead } from '../components/ui'
import { SCHOOL_TYPES } from '../lib/labels'
import { useApi } from '../lib/useApi'

/** Багшийн профайл үүсгэх — сургуулийн төрөл сонгоход багшийн код олгогдоно */
export default function Setup() {
  const navigate = useNavigate()
  const { show } = useToast()
  const { data } = useApi('/studexa/me')
  const [schoolType, setSchoolType] = useState('SCHOOL')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)

  if (data?.teacher && !created) {
    navigate('/studexa', { replace: true })
    return null
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const t = await api('/studexa/teacher', {
        method: 'POST',
        body: { schoolType, ...(schoolType === 'UNIVERSITY' ? { code } : {}) },
      })
      setCreated(t)
      show('Багшийн профайл үүслээ')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <div className="text-center">
            <div className="text-4xl">🎉</div>
            <h1 className="mt-2 font-serif text-2xl">Бүртгэл амжилттай!</h1>
            <p className="mt-1 text-sm text-ink-muted">Таны багшийн код:</p>
            <div className="mt-4 inline-block font-mono text-3xl tracking-widest border border-rule rounded px-6 py-3 bg-bg">
              {created.code}
            </div>
            <p className="mt-4 text-sm text-ink-muted text-left">
              ⚠️ Энэ кодыг сурагчдадаа өгнө — сурагч бүртгүүлэхдээ энэ кодоор танд элсэх хүсэлт
              илгээнэ. Код тохиргооны хуудсанд үргэлж харагдана.
            </p>
            <Button className="mt-6" onClick={() => navigate('/studexa', { replace: true })}>
              Хяналт самбар руу орох
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <PageHead title="Studexa — багшийн тохиргоо" sub="Сургуулийн төрлөө сонгоно уу. Төрлөөс хамаарч багшийн код олгогдоно." />
      <form onSubmit={submit} className="mt-6 space-y-5">
        <Card>
          <div className="space-y-2">
            {SCHOOL_TYPES.map(([key, label, icon]) => (
              <label
                key={key}
                className={`flex items-center gap-3 border rounded px-3 py-2.5 cursor-pointer ${
                  schoolType === key ? 'border-accent bg-accent/10' : 'border-rule hover:border-ink-muted'
                }`}
              >
                <input type="radio" name="schoolType" value={key} checked={schoolType === key} onChange={() => setSchoolType(key)} />
                <span>{icon}</span>
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          {schoolType === 'UNIVERSITY' ? (
            <div className="mt-4">
              <Field label="Багшийн код (өөрийн)" hint="Сургуулиасаа авсан өөрийн кодоо оруулна — сурагчид энэ кодоор танд элснэ.">
                <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ж: b252270137" required />
              </Field>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">
              💡 Танд <b>trt0000</b> (ЕБС), <b>stdx0000</b> (академи) эсвэл <b>stu0000</b> (хувийн багш) хэлбэрийн код олгогдоно.
            </p>
          )}
        </Card>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" loading={saving}>Профайл үүсгэх</Button>
      </form>
    </div>
  )
}
