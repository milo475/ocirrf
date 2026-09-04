import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import Modal from '../../../components/ui/Modal'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import LineChart from '../components/LineChart'
import ReportCard from '../components/ReportCard'
import ScoreTable from '../components/ScoreTable'
import { Card, Field, inputCls, Loading, LoadError, PageHead, Pill } from '../components/ui'
import { ATT_STATUS, fmtDate, fmtDateTime, GENDER, HW_STATUS, localDateStr, PAY_STATUS, STUDENT_STATUS } from '../lib/labels'
import { useApi } from '../lib/useApi'

/** Сурагчийн дэлгэрэнгүй: ахиц, даалгавар, холбоо барих, ирц, төлбөр, дүн */
export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const { data, error, loading, reload } = useApi(`/studexa/students/${id}`)
  const { data: me } = useApi('/studexa/me')
  const [del, setDel] = useState(false)
  const [unlink, setUnlink] = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [term, setTerm] = useState('')
  const { data: terms } = useApi('/studexa/terms')
  const { data: card, reload: reloadCard } = useApi(`/studexa/students/${id}/report-card${term ? `?term=${term}` : ''}`)
  const uni = me?.teacher?.schoolType === 'UNIVERSITY'

  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const s = data.student

  async function call(path, body, msg) {
    try {
      await api(path, { method: 'POST', body })
      if (msg) show(msg)
      reload()
    } catch (e) {
      show(e.message, { type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHead
        title={s.name}
        sub={`${s.group || 'Бүлэггүй'} · Ирц: ${s.attendance}%${s.studentCode ? ` · Оюутны код: ${s.studentCode}` : ''}${s.status !== 'ACTIVE' ? ` · ${STUDENT_STATUS[s.status]?.label}` : ''}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(`/studexa/students/${id}/edit`)}>✎ Засах</Button>
            <Button variant="danger" onClick={() => setDel(true)}>🗑 Устгах</Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card title="📈 Ахицын график (оноо бүр өөрийн дээд оноотой харьцуулсан хувиар)">
            <LineChart chart={data.progressChart} empty="Оноо (даалгавар, сорил г.м.) тавигдсаны дараа ахицын график энд гарна." />
          </Card>
          <Card title="Гэрийн даалгавар">
            {data.homeworks.length === 0 ? (
              <p className="text-sm text-ink-muted">Даалгавар алга.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
                      <th className="text-left py-2 pr-2 font-normal">Эхлэх</th>
                      <th className="text-left py-2 px-2 font-normal">Дуусах</th>
                      <th className="text-left py-2 px-2 font-normal">Даалгавар</th>
                      <th className="text-left py-2 px-2 font-normal">Оноо</th>
                      <th className="text-left py-2 pl-2 font-normal">Төлөв</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.homeworks.map((hw) => (
                      <tr key={hw.id} className="border-b border-rule align-top">
                        <td className="py-2 pr-2 font-mono text-xs">{fmtDate(hw.date)}</td>
                        <td className="py-2 px-2 font-mono text-xs">{fmtDate(hw.dueDate)}</td>
                        <td className="py-2 px-2 whitespace-pre-wrap max-w-xs">{hw.title}</td>
                        <td className="py-2 px-2 font-mono">{hw.score === null ? '—' : `${hw.score}${hw.gradeColumn ? ` / ${hw.gradeColumn.maxScore}` : ''}`}</td>
                        <td className="py-2 pl-2"><Pill item={HW_STATUS[hw.status]} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Мэдээлэл, холбоо барих">
            <dl className="text-sm divide-y divide-rule">
              <Row label="Төлөв"><Pill item={STUDENT_STATUS[s.status] ?? STUDENT_STATUS.ACTIVE} /></Row>
              <Row label="Регистр / код">{s.registerNo || '—'}</Row>
              <Row label="Төрсөн огноо">{s.birthDate ? fmtDate(s.birthDate) : '—'}</Row>
              <Row label="Хүйс">{s.gender ? GENDER[s.gender] : '—'}</Row>
              <Row label="Хаяг">{s.address || '—'}</Row>
              <Row label="Холбогдсон акаунт">
                {s.user ? (
                  <span className="flex items-center gap-2">
                    <Pill item={{ label: `🔗 ${s.user.username}`, cls: 'text-safe border-safe/40 bg-safe/12 normal-case' }} />
                    <button type="button" className="text-xs text-alarm/80 hover:text-alarm" onClick={() => setUnlink(true)}>Салгах</button>
                  </span>
                ) : (
                  <span className="text-ink-muted">Холбогдоогүй</span>
                )}
              </Row>
              <Row label="Сурагчийн утас">{s.phone || '—'}</Row>
              <Row label="Аавын нэр">{s.fatherName || '—'}</Row>
              <Row label="Аавын утас">{s.fatherPhone || '—'}</Row>
              <Row label="Ээжийн нэр">{s.motherName || '—'}</Row>
              <Row label="Ээжийн утас">{s.motherPhone || '—'}</Row>
            </dl>
          </Card>
          <Card title="Ирц">
            <p className="text-sm">{s.attendedLessons} / {s.totalLessons} хичээлд ирсэн ({s.attendance}%)</p>
            <ul className="mt-2 divide-y divide-rule text-sm">
              {data.attendances.map((a) => (
                <li key={a.id} className="py-1.5 flex justify-between">
                  <span className="font-mono text-xs">{fmtDate(a.date)}{a.lesson ? ` · ${a.lesson.title}` : ''}</span>
                  <Pill item={ATT_STATUS[a.status]} />
                </li>
              ))}
              {data.attendances.length === 0 && <li className="py-1.5 text-ink-muted">Ирцийн бүртгэл хийгдээгүй байна.</li>}
            </ul>
          </Card>
          {!uni && (
            <PaymentCard
              data={data}
              id={id}
              call={call}
              onDelete={(year, month) =>
                api(`/studexa/students/${id}/payments/${year}/${month}`, { method: 'DELETE' })
                  .then(reload)
                  .catch((e) => show(e.message, { type: 'error' }))
              }
            />
          )}
        </div>
      </div>

      <ReportCard card={card} terms={terms ?? []} term={term} onTerm={setTerm} />

      <NotesCard studentId={id} />

      <Card
        title={`Дүнгийн хүснэгт (${fmtDate(s.enrolled)}-нд бүртгүүлсэн)`}
        action={
          <>
            <Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to={`/studexa/gradebook${s.group ? `?group=${encodeURIComponent(s.group)}` : ''}`}>✎ Нэгтгэл засах</Link>
            <Button onClick={() => setScoreOpen(true)}>+ Оноо нэмэх</Button>
          </>
        }
      >
        <ScoreTable table={data.scoreTable} />
      </Card>

      <AssessmentModal open={scoreOpen} onClose={() => setScoreOpen(false)} studentId={id} onSaved={() => { setScoreOpen(false); reload(); reloadCard() }} />
      <ConfirmDialog open={del} title="Сурагч устгах" message={`«${s.name}» сурагчийн даалгавар, дүн, төлбөрийн бүх мэдээлэл хамт устана.`} confirmLabel="Тийм, устгах" danger
        onConfirm={async () => { await api(`/studexa/students/${id}`, { method: 'DELETE' }); navigate('/studexa/students') }} onCancel={() => setDel(false)} />
      <ConfirmDialog open={unlink} title="Акаунт салгах" message="Сурагчийн акаунт-холболтыг салгах уу? Сурагч порталаас энэ бүртгэлийг харахаа болино." confirmLabel="Салгах" danger
        onConfirm={async () => { setUnlink(false); await call(`/studexa/students/${id}/unlink`, undefined, 'Салгагдлаа') }} onCancel={() => setUnlink(false)} />
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="py-2 flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

function PaymentCard({ data, id, call, onDelete }) {
  const [month, setMonth] = useState(data.currentMonth)
  const [year, setYear] = useState(data.currentYear ?? new Date().getFullYear())
  const [status, setStatus] = useState('PAID')
  const years = [data.currentYear - 1, data.currentYear, data.currentYear + 1]
  return (
    <Card title="💳 Сарын төлбөр">
      <ul className="divide-y divide-rule text-sm">
        {data.payments.map((p) => (
          <li key={p.id} className="py-1.5 flex items-center justify-between">
            <span>{p.year} он · {p.month}-р сар</span>
            <span className="flex items-center gap-2">
              <Pill item={PAY_STATUS[p.status]} />
              <button type="button" className="text-ink-muted hover:text-alarm" title="Энэ сарын бүртгэлийг устгах"
                onClick={() => onDelete(p.year, p.month)}>✕</button>
            </span>
          </li>
        ))}
        {data.payments.length === 0 && <li className="py-1.5 text-ink-muted">Сарын төлбөр бүртгэгдээгүй байна.</li>}
      </ul>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); call(`/studexa/students/${id}/payments`, { year: Number(year), month: Number(month), status }, 'Хадгалагдлаа') }}>
        <select className={`${inputCls} w-auto`} value={year} onChange={(e) => setYear(e.target.value)}>
          {years.map((y) => <option key={y} value={y}>{y} он</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={month} onChange={(e) => setMonth(e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}-р сар</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PAID">Төлсөн</option>
          <option value="PENDING">Хүлээгдэж буй</option>
          <option value="OVERDUE">Хоцорсон</option>
        </select>
        <Button type="submit">Хадгалах</Button>
      </form>
      <p className="mt-2 text-xs text-ink-muted">Аль нэг сар «Хоцорсон» бол сурагчийн ерөнхий төлбөрийн төлөв автоматаар «Хоцорсон» болно.</p>
    </Card>
  )
}

/** Сурагчийн хувийн тэмдэглэл — зан байдал, эцэг эхтэй ярилцсан, анхаарах зүйл (багшид л харагдана) */
function NotesCard({ studentId }) {
  const { show } = useToast()
  const { data: notes, reload } = useApi(`/studexa/students/${studentId}/notes`)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  async function add(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      await api(`/studexa/students/${studentId}/notes`, { method: 'POST', body: { text } })
      setText('')
      reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card title="📝 Сурагчийн тэмдэглэл (зан байдал, эцэг эхтэй ярилцсан г.м. — зөвхөн багшид)">
      <form onSubmit={add} className="flex gap-2">
        <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="ж: 09.04 — ээжтэй нь ярилцав, гэрийн даалгаврыг хянана" />
        <Button type="submit" loading={saving}>Нэмэх</Button>
      </form>
      <ul className="mt-3 divide-y divide-rule text-sm">
        {(notes ?? []).map((n) => (
          <li key={n.id} className="py-2 flex gap-3">
            <span className="font-mono text-xs text-ink-muted whitespace-nowrap">{fmtDateTime(n.createdAt)}</span>
            <span className="flex-1 whitespace-pre-wrap">{n.text}</span>
            <button type="button" className="text-ink-muted hover:text-alarm" onClick={() => api(`/studexa/students/${studentId}/notes/${n.id}`, { method: 'DELETE' }).then(reload).catch((e) => show(e.message, { type: 'error' }))}>✕</button>
          </li>
        ))}
        {notes && notes.length === 0 && <li className="py-2 text-ink-muted">Тэмдэглэл алга.</li>}
      </ul>
    </Card>
  )
}

function AssessmentModal({ open, onClose, studentId, onSaved }) {
  const { show } = useToast()
  const { data: gb } = useApi('/studexa/gradebook', [open])
  const [form, setForm] = useState({ columnId: '', newColumnName: '', newColumnMax: 100, date: localDateStr(), score: 0 })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api(`/studexa/students/${studentId}/assessments`, {
        method: 'POST',
        body: {
          ...(form.columnId ? { columnId: form.columnId } : { newColumnName: form.newColumnName, newColumnMax: Number(form.newColumnMax) }),
          date: form.date,
          score: Number(form.score),
        },
      })
      show('Оноо хадгалагдлаа')
      onSaved()
    } catch (err) {
      show(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Оноо нэмэх" footer={<><Button variant="ghost" onClick={onClose}>Болих</Button><Button loading={saving} onClick={submit}>Хадгалах</Button></>}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Байгаа багана сонгох">
          <select className={inputCls} value={form.columnId} onChange={set('columnId')}>
            <option value="">— Сонгохгүй (доор шинэ багана үүсгэнэ) —</option>
            {(gb?.columns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} (дээд {c.maxScore} оноо)</option>)}
          </select>
        </Field>
        {!form.columnId && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Шинэ баганын нэр"><input className={inputCls} value={form.newColumnName} onChange={set('newColumnName')} placeholder="ж: Даалгавар 1" /></Field>
            <Field label="Дээд оноо"><input className={inputCls} type="number" min={1} max={1000} value={form.newColumnMax} onChange={set('newColumnMax')} /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Огноо"><input className={inputCls} type="date" value={form.date} onChange={set('date')} required /></Field>
          <Field label="Оноо"><input className={inputCls} type="number" min={0} value={form.score} onChange={set('score')} required /></Field>
        </div>
      </form>
    </Modal>
  )
}
