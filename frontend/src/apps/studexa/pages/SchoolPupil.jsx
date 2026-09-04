import { useState } from 'react'
import { Link, useParams } from 'react-router'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import ReportCard from '../components/ReportCard'
import ScheduleGrid from '../components/ScheduleGrid'
import { Card, Field, inputCls, Loading, LoadError, PageHead, Pill } from '../components/ui'
import { ATT_STATUS, fmtDate, GENDER, PAY_STATUS, STUDENT_STATUS } from '../lib/labels'
import { useApi } from '../lib/useApi'

/** Сурагчийн мастер бүртгэл: профайл, багш бүрийн roster, нэгдсэн дүн/ирц, ангийн хуваарь */
export default function SchoolPupil() {
  const { id } = useParams()
  const { show } = useToast()
  const { data, error, loading, reload } = useApi(`/studexa/school/pupils/${id}`)
  const [edit, setEdit] = useState(null)
  const [email, setEmail] = useState('')
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const p = data.pupil

  async function call(path, opts, msg) {
    try {
      await api(path, opts)
      if (msg) show(msg)
      reload()
      return true
    } catch (e) {
      show(e.message, { type: 'error' })
      return false
    }
  }

  async function save(e) {
    e.preventDefault()
    if (await call(`/studexa/school/pupils/${id}`, { method: 'PATCH', body: edit }, 'Хадгалагдлаа — бүх багшийн жагсаалтад шинэчлэгдлээ')) setEdit(null)
  }

  return (
    <div className="space-y-6">
      <PageHead
        title={p.name}
        sub={`${data.class ? `🏫 ${data.class.name}` : 'Ангигүй'} · ${STUDENT_STATUS[p.status]?.label ?? p.status} · ${data.rosters.length} багшийн жагсаалтад`}
        actions={
          <>
            {data.class && <Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to={`/studexa/school/classes/${data.class.id}`}>← {data.class.name}</Link>}
            {data.canWrite && <Button variant="ghost" onClick={() => setEdit({ name: p.name, registerNo: p.registerNo, birthDate: p.birthDate ?? '', gender: p.gender ?? '', phone: p.phone, address: p.address, fatherName: p.fatherName, fatherPhone: p.fatherPhone, motherName: p.motherName, motherPhone: p.motherPhone, status: p.status })}>✎ Засах</Button>}
          </>
        }
      />

      {edit && (
        <Card title="Мастер бүртгэл засах (бүх багшийн жагсаалтад тархана)">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
            <Field label="Нэр"><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required maxLength={100} /></Field>
            <Field label="Регистр"><input className={inputCls} value={edit.registerNo} onChange={(e) => setEdit({ ...edit, registerNo: e.target.value })} maxLength={30} /></Field>
            <Field label="Төрсөн огноо"><input type="date" className={inputCls} value={edit.birthDate} onChange={(e) => setEdit({ ...edit, birthDate: e.target.value })} /></Field>
            <Field label="Хүйс"><select className={inputCls} value={edit.gender} onChange={(e) => setEdit({ ...edit, gender: e.target.value })}><option value="">—</option>{Object.entries(GENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Утас"><input className={inputCls} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} maxLength={20} /></Field>
            <Field label="Хаяг"><input className={inputCls} value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} maxLength={200} /></Field>
            <Field label="Аавын нэр"><input className={inputCls} value={edit.fatherName} onChange={(e) => setEdit({ ...edit, fatherName: e.target.value })} maxLength={100} /></Field>
            <Field label="Аавын утас"><input className={inputCls} value={edit.fatherPhone} onChange={(e) => setEdit({ ...edit, fatherPhone: e.target.value })} maxLength={20} /></Field>
            <Field label="Ээжийн нэр"><input className={inputCls} value={edit.motherName} onChange={(e) => setEdit({ ...edit, motherName: e.target.value })} maxLength={100} /></Field>
            <Field label="Ээжийн утас"><input className={inputCls} value={edit.motherPhone} onChange={(e) => setEdit({ ...edit, motherPhone: e.target.value })} maxLength={20} /></Field>
            <Field label="Төлөв"><select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <div className="flex items-end gap-2"><Button type="submit">Хадгалах</Button><Button variant="ghost" onClick={() => setEdit(null)}>Болих</Button></div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Мэдээлэл">
          <dl className="text-sm divide-y divide-rule">
            <Row label="Төлөв"><Pill item={STUDENT_STATUS[p.status]} /></Row>
            <Row label="Регистр">{p.registerNo || '—'}</Row>
            <Row label="Төрсөн огноо">{p.birthDate ? fmtDate(p.birthDate) : '—'}</Row>
            <Row label="Хүйс">{p.gender ? GENDER[p.gender] : '—'}</Row>
            <Row label="Утас">{p.phone || '—'}</Row>
            <Row label="Хаяг">{p.address || '—'}</Row>
            <Row label="Аав">{p.fatherName || '—'} {p.fatherPhone}</Row>
            <Row label="Ээж">{p.motherName || '—'} {p.motherPhone}</Row>
            <Row label="Элссэн">{fmtDate(p.enrolled)}</Row>
          </dl>
        </Card>
        <Card title="🔗 Сурагчийн акаунт">
          {p.userId ? (
            <div className="text-sm">
              <p>Акаунт холбогдсон — сурагч порталаас бүх багшийн дүн, ирц, ангийн нэгдсэн дүнгийн хуудсаа харна.</p>
              {data.canWrite && <Button variant="ghost" className="mt-2" onClick={() => call(`/studexa/school/pupils/${id}/unlink`, { method: 'POST' }, 'Салгагдлаа')}>Салгах</Button>}
            </div>
          ) : (
            <form className="text-sm space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await call(`/studexa/school/pupils/${id}/link`, { method: 'POST', body: { email } }, 'Холбогдлоо')) setEmail('') }}>
              <p className="text-ink-muted">Сурагчийн бүртгэлтэй акаунтын и-мэйлийг оруулж холбоно (эсвэл сурагч багшийн кодоор элсэх хүсэлт илгээж, багш батлахад автоматаар холбогдоно).</p>
              {data.canWrite && (
                <div className="flex gap-2">
                  <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="surag@example.mn" required />
                  <Button type="submit">Холбох</Button>
                </div>
              )}
            </form>
          )}
        </Card>
        <Card title="👩‍🏫 Багш бүрийн бүртгэл (roster)">
          <ul className="divide-y divide-rule text-sm">
            {data.rosters.map((r) => (
              <li key={r.id} className="py-2">
                <b>{r.teacher.name}</b> <span className="text-xs text-ink-muted">{r.subject ?? ''} · {r.group}</span>
                <span className="block text-xs text-ink-muted font-mono">ирц {r.attendance}% · даалгавар {r.hwPercent ?? '—'}{r.hwPercent !== null ? '%' : ''} · <Pill item={PAY_STATUS[r.paymentStatus]} /></span>
              </li>
            ))}
            {data.rosters.length === 0 && <li className="py-2 text-ink-muted">Ангид багш оноогоогүй тул roster алга.</li>}
          </ul>
        </Card>
      </div>

      <Card title={`📄 Нэгдсэн дүнгийн хуудас — дундаж ${data.report.percent === null ? '—' : `${data.report.percent}%`} (${data.report.letter})`}>
        {data.report.sections.length === 0 ? <p className="text-sm text-ink-muted">Багш нар оноо тавьсны дараа хичээл бүрийн дүн энд нэгтгэгдэнэ.</p> : (
          <div className="space-y-4">
            {data.report.sections.map((s) => (
              <div key={s.teacher.id}>
                <p className="text-sm font-medium mb-1">{s.subject ?? 'Хичээл'} — {s.teacher.name} <span className="text-xs text-ink-muted">{s.card.term ? `· ${s.card.term.name}` : ''}</span></p>
                <ReportCard card={s.card} title={`${s.subject ?? ''} ${s.teacher.name}`} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Ирцийн түүх (бүх багш)">
          <ul className="divide-y divide-rule text-sm">
            {data.attendances.map((a) => (
              <li key={a.id} className="py-1.5 flex justify-between gap-2">
                <span className="font-mono text-xs">{fmtDate(a.date)} · {a.lessonTitle ?? 'ерөнхий'} <span className="text-ink-muted">({a.teacherName})</span></span>
                <Pill item={ATT_STATUS[a.status]} />
              </li>
            ))}
            {data.attendances.length === 0 && <li className="py-1.5 text-ink-muted">Ирц бүртгэгдээгүй.</li>}
          </ul>
        </Card>
        <Card title="🗓 Ангийн хуваарь" className="lg:col-span-2">
          {data.timetable.days.some((d) => d.lessons.length) ? <ScheduleGrid grid={data.timetable} showGroup={false} /> : <p className="text-sm text-ink-muted">Хуваарь алга.</p>}
        </Card>
      </div>
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
