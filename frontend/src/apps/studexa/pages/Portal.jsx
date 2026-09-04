import { useState } from 'react'
import { useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { api, apiUpload } from '../../../lib/api'
import LineChart from '../components/LineChart'
import ReportCard from '../components/ReportCard'
import ScheduleGrid from '../components/ScheduleGrid'
import ScoreTable from '../components/ScoreTable'
import { Card, Field, inputCls, Loading, LoadError, Notice, PageHead, Pill, Stat, Tabs } from '../components/ui'
import { ATT_STATUS, fmtDate, fmtDateTime, HW_STATUS, PAY_STATUS } from '../lib/labels'
import { downloadFile, useApi } from '../lib/useApi'
import { FileLink } from './Homework'

const SECTIONS = [
  ['overview', 'Миний самбар'],
  ['teacher', 'Багш'],
  ['schedule', 'Хичээлийн хуваарь'],
  ['attendance', 'Ирцийн түүх'],
  ['homework', 'Миний даалгавар'],
  ['grades', 'Миний дүн'],
  ['report', 'Дүнгийн хуудас'],
  ['payment', 'Төлбөр'],
  ['announcements', 'Зарлал'],
]

/** Сурагчийн портал — Studexa-гийн student_portal */
export default function Portal() {
  const { show } = useToast()
  const [params, setParams] = useSearchParams()
  const t = params.get('t') ?? ''
  const section = params.get('section') ?? 'overview'
  const { data, error, loading, reload } = useApi(`/studexa/portal${t ? `?t=${t}` : ''}`)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState(null)
  const [leave, setLeave] = useState(false)

  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  function go(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  async function join(e) {
    e.preventDefault()
    try {
      await api('/studexa/portal/join', { method: 'POST', body: { code } })
      setNotice({ tone: 'ok', text: '✓ Хүсэлт илгээгдлээ. Багш баталгаажуулсны дараа мэдээлэл харагдана.' })
      setCode('')
      reload()
    } catch (err) {
      setNotice({ tone: 'error', text: err.message })
    }
  }

  const cur = data.current
  const sec = cur?.hidePayment && section === 'payment' ? 'overview' : section
  const secItems = SECTIONS.filter(([k]) => !(k === 'payment' && cur?.hidePayment))

  return (
    <div className="space-y-5">
      <PageHead title={secItems.find(([k]) => k === sec)?.[1] ?? 'Миний самбар'} sub={cur ? `${cur.name}${cur.group ? ` · ${cur.group}` : ''} · Багш: ${cur.teacher.name}` : undefined} />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {data.pending.length > 0 && (sec === 'overview' || !cur) && (
        <Card title="Хүлээгдэж буй хүсэлт">
          <ul className="text-sm divide-y divide-rule">
            {data.pending.map((p) => (
              <li key={p.id} className="py-1.5 flex justify-between"><span>{p.teacherName} багшид илгээсэн</span><Pill item={PAY_STATUS.PENDING} /></li>
            ))}
          </ul>
        </Card>
      )}

      {!cur ? (
        <div className="max-w-md mx-auto">
          <Card title="🎓 Багштайгаа холбогдох">
            <p className="text-sm text-ink-muted">Багшаас өгсөн кодыг (жишээ нь <b>trt0000</b>) оруулаад хүсэлт илгээнэ үү. Багш баталгаажуулсны дараа хичээлийн хуваарь, дүн, ирц, даалгавар тань эндээс харагдана.</p>
            <form onSubmit={join} className="mt-4 flex gap-2">
              <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="trt0000" required />
              <Button type="submit">Хүсэлт илгээх</Button>
            </form>
          </Card>
        </div>
      ) : (
        <>
          {data.records.length > 1 && (
            <Tabs items={data.records.map((r) => [r.id, r.teacherName])} value={cur.id} onChange={(v) => go('t', v)} />
          )}
          <Tabs items={secItems} value={sec} onChange={(v) => go('section', v === 'overview' ? '' : v)} />

          {sec === 'overview' && (
            <>
              <div className={`grid gap-4 sm:grid-cols-2 ${cur.hidePayment ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
                <Stat label="Ирц" value={`${cur.attendance}%`} tone="text-accent" />
                <Stat label="Нийт дүн" value={cur.scoreTable && cur.scoreTable.possible ? `${cur.scoreTable.percent}%` : '—'} sub={cur.scoreTable?.possible ? `${cur.scoreTable.totalLabel} оноо` : undefined} />
                <Stat label="Хийгээгүй даалгавар" value={cur.pendingHw} tone={cur.pendingHw ? 'text-status-preparing' : 'text-accent'} />
                {!cur.hidePayment && <Stat label="Төлбөр" value={<Pill item={PAY_STATUS[cur.paymentStatus]} />} />}
              </div>
              <Card title="📈 Миний ахиц (оноо бүр өөрийн дээд оноотой харьцуулсан хувиар)">
                <LineChart chart={cur.progressChart} empty="Багш танд оноо (даалгавар, сорил г.м.) тавьсны дараа ахицын шугаман график энд гарна." />
              </Card>
            </>
          )}

          {sec === 'teacher' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Миний багш">
                <p className="text-lg">{cur.teacher.name}</p>
                <p className="text-sm text-ink-muted mt-1">📞 {cur.teacher.phone || '—'}</p>
                <p className="text-sm text-ink-muted">✉ {cur.teacher.email}</p>
                <p className="text-sm text-ink-muted">🔑 Багшийн код: <span className="font-mono">{cur.teacher.code}</span></p>
              </Card>
              <div className="space-y-4">
                <Card title="+ Өөр багштай холбогдох">
                  <p className="text-sm text-ink-muted">Өөр багшаас хичээл авдаг бол тэр багшийн кодыг оруулж хүсэлт илгээгээрэй.</p>
                  <form onSubmit={join} className="mt-3 flex gap-2">
                    <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Багшийн код" required />
                    <Button type="submit" variant="ghost">Илгээх</Button>
                  </form>
                </Card>
                <Card title="Багшаас салах">
                  <p className="text-sm text-ink-muted">Энэ багшийн бүртгэлээс салбал хуваарь, дүн, даалгавар тань харагдахаа болино.</p>
                  <Button variant="danger" className="mt-3" onClick={() => setLeave(true)}>Багшаас салах</Button>
                </Card>
              </div>
            </div>
          )}

          {sec === 'schedule' && (
            <Card title="🗓 Хичээлийн хуваарь" action={cur.hasLessons && <Button variant="ghost" onClick={() => downloadFile(`/studexa/portal/schedule.svg?t=${cur.id}`, 'huvaari.svg').catch((e) => show(e.message, { type: 'error' }))}>⬇ SVG</Button>}>
              {cur.hasLessons ? <ScheduleGrid grid={cur.schedule} showGroup={false} /> : <p className="text-sm text-ink-muted">Хуваарь оруулаагүй байна.</p>}
            </Card>
          )}

          {sec === 'attendance' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Ирц" value={`${cur.attendance}%`} tone="text-accent" />
                <Stat label="Ирсэн" value={cur.attendedLessons} />
                <Stat label="Нийт хичээл" value={cur.totalLessons} />
                <Stat label="Тасалсан" value={cur.missedLessons} tone="text-alarm" />
              </div>
              <Card title="Ирцийн түүх">
                {cur.attendances.length === 0 ? <p className="text-sm text-ink-muted">Ирц бүртгэгдээгүй байна.</p> : (
                  <ul className="divide-y divide-rule text-sm">
                    {cur.attendances.map((a) => (
                      <li key={a.id} className="py-1.5 flex justify-between"><span className="font-mono text-xs">{fmtDate(a.date)}{a.lesson ? ` · ${a.lesson.title}` : ''}</span><Pill item={ATT_STATUS[a.status]} /></li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}

          {sec === 'homework' && (
            cur.homeworks.length === 0 ? <Card><p className="text-sm text-ink-muted">Одоогоор даалгавар алга. Багш даалгавар өгмөгц энд харагдана.</p></Card> :
            cur.homeworks.map((hw, i) => <HomeworkItem key={hw.id} hw={hw} open={i === 0} today={cur.today} recordId={cur.id} onDone={reload} />)
          )}

          {sec === 'grades' && <Card title="📊 Миний дүн"><ScoreTable table={cur.scoreTable} /></Card>}

          {sec === 'report' && <PortalReportCard recordId={cur.id} />}

          {sec === 'announcements' && (
            cur.announcements.length === 0 ? <Card><p className="text-sm text-ink-muted">Одоогоор зарлал алга.</p></Card> :
            cur.announcements.map((a) => (
              <Card key={a.id}>
                <p className="text-xs text-ink-muted">📢 {cur.teacher.name} багш · {fmtDateTime(a.createdAt)} {a.group && <Pill>📁 {a.group}</Pill>}</p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{a.text}</p>
              </Card>
            ))
          )}

          {sec === 'payment' && !cur.hidePayment && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Stat label="Одоогийн төлөв" value={<Pill item={PAY_STATUS[cur.paymentStatus]} />} />
                <Stat label="Бүртгүүлсэн огноо" value={fmtDate(cur.enrolled)} />
              </div>
              <Card title="💳 Төлбөрийн түүх">
                {cur.payments.length === 0 ? <p className="text-sm text-ink-muted">Сарын төлбөрийн бүртгэл хийгдээгүй байна. Дэлгэрэнгүйг багшаасаа лавлана уу.</p> : (
                  <ul className="divide-y divide-rule text-sm">
                    {cur.payments.map((p) => <li key={p.id} className="py-1.5 flex justify-between"><span>{p.year} он · {p.month}-р сар</span><Pill item={PAY_STATUS[p.status]} /></li>)}
                  </ul>
                )}
              </Card>
            </>
          )}
        </>
      )}
      <ConfirmDialog open={leave} title="Багшаас салах" message="Итгэлтэй байна уу? Багш дахин баталгаажуулснаар сэргэнэ." danger confirmLabel="Багшаас салах"
        onConfirm={async () => { setLeave(false); await api(`/studexa/portal/leave/${cur.id}`, { method: 'POST' }).catch((e) => show(e.message, { type: 'error' })); go('t', ''); reload() }} onCancel={() => setLeave(false)} />
    </div>
  )
}

/** Сурагчийн өөрийн улирлын дүнгийн хуудас (багшийнхтай ижил формат) */
function PortalReportCard({ recordId }) {
  const [term, setTerm] = useState('')
  const { data, error, loading, reload } = useApi(`/studexa/portal/report-card?t=${recordId}${term ? `&term=${term}` : ''}`)
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  return <ReportCard card={data} terms={data.terms} term={term} onTerm={setTerm} title="📄 Миний дүнгийн хуудас" />
}

function HomeworkItem({ hw, open, today, onDone }) {
  const { show } = useToast()
  const [file, setFile] = useState(null)
  const [link, setLink] = useState(hw.submission?.link ?? '')
  const [comment, setComment] = useState(hw.submission?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const overdue = hw.status !== 'DONE' && hw.dueDate && hw.dueDate < today

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiUpload(`/studexa/portal/homework/${hw.id}/submit`, { file: file ?? undefined, link, comment })
      show('Даалгавар багшид илгээгдлээ')
      onDone()
    } catch (err) {
      show(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <details open={open} className="bg-surface border border-rule rounded-lg">
      <summary className="cursor-pointer p-4 flex flex-wrap items-center gap-3">
        <span className="text-xl">📘</span>
        <span className="flex-1 min-w-48">
          <span className="block font-medium truncate">{hw.title.split('\n')[0]}</span>
          <span className="block text-xs text-ink-muted">
            {fmtDate(hw.date)}{hw.dueDate ? ` → ${fmtDate(hw.dueDate)} хүртэл` : ''}{overdue ? ' ⚠ хугацаа хэтэрсэн' : ''}
            {hw.attachmentUrl ? ' · 📎' : ''}{hw.link ? ' · 🔗' : ''}
          </span>
        </span>
        <span className="flex gap-1.5">
          {hw.score !== null && <Pill item={{ label: `⭐ ${hw.score}${hw.gradeColumn ? ` / ${hw.gradeColumn.maxScore}` : ''}`, cls: 'text-status-new border-status-new/40 bg-status-new/12' }} />}
          <Pill item={hw.submission ? { label: '📤 Илгээсэн', cls: 'text-safe border-safe/40 bg-safe/12' } : { label: 'Илгээгээгүй', cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' }} />
          <Pill item={HW_STATUS[hw.status]} />
        </span>
      </summary>
      <div className="border-t border-rule p-4 space-y-4">
        <p className="text-sm whitespace-pre-wrap">{hw.title}</p>
        {(hw.attachmentUrl || hw.link) && (
          <div className="flex gap-2">
            {hw.attachmentUrl && <FileLink url={hw.attachmentUrl} label="📎 Хавсралт үзэх" />}
            {hw.link && <a className="border border-rule rounded px-3 py-1.5 text-sm hover:border-ink-muted" href={hw.link} target="_blank" rel="noopener">🔗 Линк нээх</a>}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border border-rule rounded p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-ink-muted mb-2">Миний илгээсэн ажил</p>
            {hw.submission ? (
              <div className="space-y-1">
                {hw.submission.fileUrl && <FileLink url={hw.submission.fileUrl} label="📥 Илгээсэн файл" small />}
                {hw.submission.link && <p><a className="underline underline-offset-2" href={hw.submission.link} target="_blank" rel="noopener">🔗 Илгээсэн линк</a></p>}
                {hw.submission.comment && <p className="text-ink-muted whitespace-pre-wrap">💬 {hw.submission.comment}</p>}
                <p className="text-xs text-ink-muted">Илгээсэн: {fmtDateTime(hw.submission.submittedAt)}</p>
              </div>
            ) : (
              <p className="text-ink-muted">Та ажлаа хараахан илгээгээгүй байна.</p>
            )}
          </div>
          <form onSubmit={submit} className="border border-rule rounded p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-ink-muted">{hw.submission ? 'Дахин илгээх' : '📤 Ажлаа илгээх'}</p>
            <Field label="Файл (PDF, зураг)"><input type="file" accept=".pdf,image/*" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
            <Field label="эсвэл линк"><input className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></Field>
            <Field label="Тайлбар (заавал биш)"><textarea className={inputCls} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
            <Button type="submit" loading={saving}>Багшид илгээх</Button>
          </form>
        </div>
      </div>
    </details>
  )
}
