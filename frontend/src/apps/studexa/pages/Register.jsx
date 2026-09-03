import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../../context/AuthContext'
import { api } from '../../../lib/api'
import { SCHOOL_TYPES } from '../lib/labels'

const inputCls =
  'w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted'

/**
 * СУРАГЧИЙН НЭЭЛТТЭЙ БҮРТГЭЛ (нэвтрэлтгүй) — багшийн кодоор багшийн
 * байгууллагад акаунт үүсч, элсэх хүсэлт автоматаар илгээгдэнэ.
 * Платформын бүрхүүлийн гадна (публик route) тул өөрийн layout-тай.
 */
export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [params] = useSearchParams()
  const [form, setForm] = useState({
    teacherCode: params.get('code') ?? '', schoolType: 'SCHOOL', studentCode: '',
    lastName: '', firstName: '', phone: '', email: '', password: '', password2: '',
    fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
  })
  const [teacher, setTeacher] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value })
    if (k === 'teacherCode') setTeacher(null)
  }

  // Кодыг урьдчилан шалгаж багшийн нэр, төрлийг харуулна (400мс debounce)
  useEffect(() => {
    const code = form.teacherCode.trim()
    if (code.length < 3) return
    const id = setTimeout(() => {
      api(`/studexa/teacher-code/${encodeURIComponent(code)}`)
        .then((t) => { setTeacher(t); setForm((f) => ({ ...f, schoolType: t.schoolType })) })
        .catch(() => setTeacher({ notFound: true }))
    }, 400)
    return () => clearTimeout(id)
  }, [form.teacherCode])

  const uni = form.schoolType === 'UNIVERSITY'

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (form.password !== form.password2) { setError('Нууц үг таарахгүй байна'); return }
    setSaving(true)
    try {
      const { password2: _p2, ...body } = form
      await api('/studexa/register-student', { method: 'POST', body })
      await login(form.email.trim().toLowerCase(), form.password)
      navigate('/studexa/portal', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg text-ink flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-surface border border-rule rounded-lg p-6 md:p-8">
        <p className="font-serif text-2xl">Studexa — Сурагчийн бүртгэл</p>
        <p className="mt-1 text-sm text-ink-muted">Багшийн кодоор бүртгүүлж, багшдаа элсэх хүсэлт илгээнэ.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <L label="Багшийн код">
            <input className={`${inputCls} font-mono`} value={form.teacherCode} onChange={set('teacherCode')} placeholder="trt0000" required />
            {teacher && (teacher.notFound ? <p className="mt-1 text-xs text-alarm">Ийм кодтой багш олдсонгүй</p> : <p className="mt-1 text-xs text-safe">✓ {teacher.teacherName} багш · {teacher.organizationName}</p>)}
          </L>
          <L label="Сургуулийн төрөл">
            <div className="grid grid-cols-2 gap-2">
              {SCHOOL_TYPES.map(([k, v, icon]) => (
                <label key={k} className={`flex items-center gap-2 border rounded px-2 py-1.5 text-xs cursor-pointer ${form.schoolType === k ? 'border-accent bg-accent/10' : 'border-rule'}`}>
                  <input type="radio" name="schoolType" value={k} checked={form.schoolType === k} onChange={() => setForm({ ...form, schoolType: k })} />{icon} {v}
                </label>
              ))}
            </div>
          </L>
          {uni && <L label="Оюутны код"><input className={inputCls} value={form.studentCode} onChange={set('studentCode')} required /></L>}
          <div className="grid grid-cols-2 gap-3">
            <L label={uni ? 'Овог' : 'Овог (заавал биш)'}><input className={inputCls} value={form.lastName} onChange={set('lastName')} required={uni} /></L>
            <L label="Нэр"><input className={inputCls} value={form.firstName} onChange={set('firstName')} required /></L>
          </div>
          <L label={uni ? 'Утасны дугаар' : 'Утасны дугаар (заавал биш)'}><input className={inputCls} value={form.phone} onChange={set('phone')} required={uni} /></L>
          <L label="И-мэйл хаяг (нэвтрэх нэр)"><input type="email" className={inputCls} value={form.email} onChange={set('email')} required /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Нууц үг"><input type="password" className={inputCls} value={form.password} onChange={set('password')} minLength={6} required /></L>
            <L label="Нууц үг (давтах)"><input type="password" className={inputCls} value={form.password2} onChange={set('password2')} required /></L>
          </div>
          <p className="text-xs uppercase tracking-wide text-ink-muted pt-2">Эцэг эхийн мэдээлэл {uni ? '' : '(заавал биш)'}</p>
          <div className="grid grid-cols-2 gap-3">
            <L label="Аавын нэр"><input className={inputCls} value={form.fatherName} onChange={set('fatherName')} /></L>
            <L label="Аавын утас"><input className={inputCls} value={form.fatherPhone} onChange={set('fatherPhone')} /></L>
            <L label="Ээжийн нэр"><input className={inputCls} value={form.motherName} onChange={set('motherName')} /></L>
            <L label="Ээжийн утас"><input className={inputCls} value={form.motherPhone} onChange={set('motherPhone')} /></L>
          </div>
          {error && <p className="text-sm text-alarm border border-alarm/60 rounded px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-ink text-bg rounded px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? 'Бүртгэж байна…' : 'Бүртгүүлэх'}
          </button>
        </form>
        <p className="mt-4 text-sm text-ink-muted text-center">
          Бүртгэлтэй юу? <Link className="underline underline-offset-2" to="/login">Нэвтрэх</Link> · <Link className="underline underline-offset-2" to="/">Нүүр</Link>
        </p>
      </div>
    </main>
  )
}

function L({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5">{label}</span>
      {children}
    </label>
  )
}
