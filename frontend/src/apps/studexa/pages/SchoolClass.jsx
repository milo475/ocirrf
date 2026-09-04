import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { api, apiUpload } from '../../../lib/api'
import ScheduleGrid from '../components/ScheduleGrid'
import { Card, Field, inputCls, Loading, LoadError, Notice, PageHead, Pill } from '../components/ui'
import { fmtDate, GENDER, STUDENT_STATUS } from '../lib/labels'
import { useApi } from '../lib/useApi'

const EMPTY = { name: '', registerNo: '', birthDate: '', gender: '', phone: '', fatherName: '', fatherPhone: '', motherName: '', motherPhone: '', address: '' }

/** Ангийн дэлгэрэнгүй: багш нар, сурагчийн мастер бүртгэл, нэгдсэн хуваарь */
export default function SchoolClass() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const { data, error, loading, reload } = useApi(`/studexa/school/classes/${id}`)
  const { data: teachers } = useApi('/studexa/school/teachers')
  const [edit, setEdit] = useState(null)
  const [addT, setAddT] = useState({ teacherId: '', subjectId: '' })
  const [pupil, setPupil] = useState(null)
  const [del, setDel] = useState(null)
  const [delClass, setDelClass] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const c = data.class

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

  async function saveClass(e) {
    e.preventDefault()
    if (await call(`/studexa/school/classes/${id}`, { method: 'PATCH', body: { name: edit.name, grade: edit.grade ? Number(edit.grade) : null, homeroomTeacherId: edit.homeroomTeacherId || undefined } }, 'Хадгалагдлаа')) setEdit(null)
  }

  async function addTeacher(e) {
    e.preventDefault()
    if (await call(`/studexa/school/classes/${id}/teachers`, { method: 'POST', body: { teacherId: addT.teacherId, subjectId: addT.subjectId || undefined } }, 'Багш нэмэгдлээ')) setAddT({ teacherId: '', subjectId: '' })
  }

  async function addPupil(e) {
    e.preventDefault()
    if (await call(`/studexa/school/classes/${id}/pupils`, { method: 'POST', body: pupil }, 'Сурагч нэмэгдлээ — багш бүрийн жагсаалтад орлоо')) setPupil(null)
  }

  async function importCsv(file) {
    if (!file) return
    try {
      const r = await apiUpload(`/studexa/school/classes/${id}/pupils/import`, { file })
      setImportResult(r)
      show(`${r.created} сурагч нэмэгдлээ`)
      reload()
    } catch (e) {
      show(e.message, { type: 'error' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const selTeacher = (teachers ?? []).find((t) => t.id === addT.teacherId)
  const memberIds = new Set(data.teachers.map((t) => t.teacher.id))

  return (
    <div className="space-y-6">
      <PageHead
        title={`🏫 ${c.name}`}
        sub={`${c.grade ? `${c.grade}-р анги · ` : ''}Ангийн багш: ${c.homeroomTeacher?.name ?? '—'} · ${data.pupils.filter((p) => p.status === 'ACTIVE').length} сурагч · ${data.teachers.length} багш`}
        actions={
          <>
            <Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to="/studexa/school">← Ангиуд</Link>
            {data.canManage && <Button variant="ghost" onClick={() => setEdit({ name: c.name, grade: c.grade ?? '', homeroomTeacherId: c.homeroomTeacher?.id ?? '' })}>✎ Засах</Button>}
            {data.canManage && <Button variant="danger" onClick={() => setDelClass(true)}>🗑 Устгах</Button>}
          </>
        }
      />

      {edit && (
        <Card title="Анги засах">
          <form onSubmit={saveClass} className="grid gap-3 sm:grid-cols-4">
            <Field label="Нэр" hint="Нэр солиход багш бүрийн бүлэг, хуваарь дагаж солигдоно"><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required maxLength={100} /></Field>
            <Field label="Анги (дугаар)"><input type="number" min={1} max={12} className={inputCls} value={edit.grade} onChange={(e) => setEdit({ ...edit, grade: e.target.value })} /></Field>
            <Field label="Ангийн багш">
              <select className={inputCls} value={edit.homeroomTeacherId} onChange={(e) => setEdit({ ...edit, homeroomTeacherId: e.target.value })}>
                <option value="">—</option>
                {(teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-2"><Button type="submit">Хадгалах</Button><Button variant="ghost" onClick={() => setEdit(null)}>Болих</Button></div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="👩‍🏫 Багш нар" className="lg:col-span-1">
          <ul className="divide-y divide-rule text-sm">
            {data.teachers.map((ct) => (
              <li key={ct.id} className="py-2 flex items-center gap-2">
                <span className="flex-1">
                  <b>{ct.teacher.name}</b> <span className="font-mono text-xs text-ink-muted">{ct.teacher.code}</span>
                  <span className="block text-xs text-ink-muted">{ct.subject?.name ?? 'хичээл сонгоогүй'}{c.homeroomTeacher?.id === ct.teacher.id ? ' · ангийн багш' : ''}</span>
                </span>
                {data.canManage && <button type="button" className="text-ink-muted hover:text-alarm" title="Ангиас хасах (багшийн өгөгдөл хэвээр)" onClick={() => call(`/studexa/school/classes/${id}/teachers/${ct.teacher.id}`, { method: 'DELETE' }, 'Багш хасагдлаа')}>✕</button>}
              </li>
            ))}
            {data.teachers.length === 0 && <li className="py-2 text-ink-muted">Багш оноогоогүй.</li>}
          </ul>
          {data.canManage && (
            <form onSubmit={addTeacher} className="mt-3 space-y-2">
              <select className={inputCls} value={addT.teacherId} onChange={(e) => setAddT({ teacherId: e.target.value, subjectId: '' })} required>
                <option value="">+ Багш нэмэх…</option>
                {(teachers ?? []).filter((t) => !memberIds.has(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
              </select>
              {selTeacher && (
                <select className={inputCls} value={addT.subjectId} onChange={(e) => setAddT({ ...addT, subjectId: e.target.value })}>
                  <option value="">Хичээл (багшийн бүртгэсэн) — заавал биш</option>
                  {selTeacher.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {addT.teacherId && <Button type="submit">Нэмэх</Button>}
            </form>
          )}
        </Card>

        <Card title="🗓 Ангийн нэгдсэн хуваарь (бүх багшийн)" className="lg:col-span-2">
          {data.timetable.days.some((d) => d.lessons.length) ? <ScheduleGrid grid={data.timetable} showGroup={false} /> : <p className="text-sm text-ink-muted">Багш нар энэ ангид хуваарь оруулаагүй байна. Багш бүр өөрийн «Хичээлийн хуваарь»-т бүлэг «{c.name}» сонгож нэмнэ.</p>}
        </Card>
      </div>

      <Card
        title="🎒 Сурагчид (мастер бүртгэл)"
        action={data.canWrite && (
          <>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => importCsv(e.target.files?.[0])} />
            <Button variant="ghost" onClick={() => fileRef.current?.click()} title="CSV толгой: нэр, утас, аавын нэр, аавын утас, ээжийн нэр, ээжийн утас, төрсөн огноо, хүйс, регистр, хаяг">⬆ CSV импорт</Button>
            <Button onClick={() => setPupil({ ...EMPTY })}>+ Сурагч нэмэх</Button>
          </>
        )}
      >
        {importResult && (
          <Notice tone={importResult.skipped.length ? 'error' : 'ok'}>
            ✓ {importResult.created} сурагч нэмэгдлээ.{importResult.skipped.length > 0 && <> Алгассан: {importResult.skipped.slice(0, 5).map((s) => `${s.line}-р мөр — ${s.reason}`).join('; ')}</>}
          </Notice>
        )}
        {pupil && (
          <form onSubmit={addPupil} className="mb-4 border border-rule rounded p-3 grid gap-3 sm:grid-cols-3">
            <Field label="Нэр"><input className={inputCls} value={pupil.name} onChange={(e) => setPupil({ ...pupil, name: e.target.value })} required maxLength={100} autoFocus /></Field>
            <Field label="Регистр"><input className={inputCls} value={pupil.registerNo} onChange={(e) => setPupil({ ...pupil, registerNo: e.target.value })} maxLength={30} /></Field>
            <Field label="Төрсөн огноо"><input type="date" className={inputCls} value={pupil.birthDate} onChange={(e) => setPupil({ ...pupil, birthDate: e.target.value })} /></Field>
            <Field label="Хүйс">
              <select className={inputCls} value={pupil.gender} onChange={(e) => setPupil({ ...pupil, gender: e.target.value })}>
                <option value="">—</option>
                {Object.entries(GENDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Утас"><input className={inputCls} value={pupil.phone} onChange={(e) => setPupil({ ...pupil, phone: e.target.value })} maxLength={20} /></Field>
            <Field label="Хаяг"><input className={inputCls} value={pupil.address} onChange={(e) => setPupil({ ...pupil, address: e.target.value })} maxLength={200} /></Field>
            <Field label="Аавын нэр"><input className={inputCls} value={pupil.fatherName} onChange={(e) => setPupil({ ...pupil, fatherName: e.target.value })} maxLength={100} /></Field>
            <Field label="Аавын утас"><input className={inputCls} value={pupil.fatherPhone} onChange={(e) => setPupil({ ...pupil, fatherPhone: e.target.value })} maxLength={20} /></Field>
            <Field label="Ээжийн нэр"><input className={inputCls} value={pupil.motherName} onChange={(e) => setPupil({ ...pupil, motherName: e.target.value })} maxLength={100} /></Field>
            <Field label="Ээжийн утас"><input className={inputCls} value={pupil.motherPhone} onChange={(e) => setPupil({ ...pupil, motherPhone: e.target.value })} maxLength={20} /></Field>
            <div className="flex items-end gap-2 sm:col-span-2"><Button type="submit">Хадгалах</Button><Button variant="ghost" onClick={() => setPupil(null)}>Болих</Button></div>
          </form>
        )}
        {data.pupils.length === 0 ? (
          <p className="text-sm text-ink-muted">Сурагч бүртгээгүй. Нэмсэн сурагч ангийн багш бүрийн «Сурагчид» жагсаалтад «{c.name}» бүлэгтэйгээр автоматаар орно.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
                  <th className="text-left py-2 pr-3 font-normal">Нэр</th>
                  <th className="text-left py-2 px-2 font-normal">Регистр</th>
                  <th className="text-left py-2 px-2 font-normal">Төрсөн</th>
                  <th className="text-right py-2 px-2 font-normal">Ирц (нэгдсэн)</th>
                  <th className="text-right py-2 px-2 font-normal">Багш</th>
                  <th className="text-left py-2 px-2 font-normal">Акаунт</th>
                  <th className="text-left py-2 px-2 font-normal">Төлөв</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {data.pupils.map((p) => (
                  <tr key={p.id} className={`border-b border-rule ${p.status !== 'ACTIVE' ? 'opacity-60' : ''}`}>
                    <td className="py-2 pr-3 font-medium"><Link className="hover:text-accent" to={`/studexa/school/pupils/${p.id}`}>{p.name}</Link></td>
                    <td className="py-2 px-2 font-mono text-xs">{p.registerNo || '—'}</td>
                    <td className="py-2 px-2 font-mono text-xs">{p.birthDate ? fmtDate(p.birthDate) : '—'}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{p.attendance.percent === null ? '—' : `${p.attendance.percent}%`}</td>
                    <td className="py-2 px-2 text-right font-mono">{p.rosters}</td>
                    <td className="py-2 px-2 text-xs text-ink-muted">{p.user ? `🔗 ${p.user.username}` : '—'}</td>
                    <td className="py-2 px-2"><Pill item={STUDENT_STATUS[p.status]} /></td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      {data.canWrite && p.status === 'ACTIVE' && <button type="button" className="text-ink-muted hover:text-ink mr-3" onClick={() => call(`/studexa/school/pupils/${p.id}/leave`, { method: 'POST' }, 'Ангиас гарлаа (шилжсэн)')}>Гаргах</button>}
                      {data.canManage && <button type="button" className="text-alarm/80 hover:text-alarm" onClick={() => setDel(p)}>Устгах</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog open={Boolean(del)} title="Сурагч бүрмөсөн устгах" message={del ? `«${del.name}» сурагчийн мастер бүртгэл + бүх багшийн ирц, дүн, даалгаврын мөр устана. Шилжсэн бол «Гаргах»-ыг ашиглана уу. Устгах уу?` : ''} danger confirmLabel="Тийм, устгах"
        onConfirm={async () => { await call(`/studexa/school/pupils/${del.id}`, { method: 'DELETE' }, 'Устгагдлаа'); setDel(null) }} onCancel={() => setDel(null)} />
      <ConfirmDialog open={delClass} title="Анги устгах" message={`«${c.name}» ангийг устгах уу? Сурагчид ангигүй болно, багш бүрийн өгөгдөл (бүлэг, ирц, дүн) хэвээр үлдэнэ.`} danger confirmLabel="Устгах"
        onConfirm={async () => { setDelClass(false); if (await call(`/studexa/school/classes/${id}`, { method: 'DELETE' }, 'Анги устгагдлаа')) navigate('/studexa/school') }} onCancel={() => setDelClass(false)} />
    </div>
  )
}
