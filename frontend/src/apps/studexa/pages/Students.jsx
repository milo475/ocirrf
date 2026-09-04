import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { api, apiUpload } from '../../../lib/api'
import ClassTable from '../components/ClassTable'
import { Card, inputCls, Loading, LoadError, Notice, PageHead, Pill } from '../components/ui'
import { PAY_STATUS, STUDENT_STATUS } from '../lib/labels'
import { downloadFile, useApi } from '../lib/useApi'

/** Сурагчдын жагсаалт + бүлгийн картууд + элсэх хүсэлтүүд + ангийн нэгтгэл */
export default function Students() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const group = params.get('group') ?? ''
  const payment = params.get('payment') ?? ''
  const status = params.get('status') ?? ''
  const term = params.get('term') ?? ''
  const page = Number(params.get('page') ?? 1)
  const qs = new URLSearchParams({ page: String(page), limit: '50' })
  if (q) qs.set('q', q)
  if (group) qs.set('group', group)
  if (payment) qs.set('payment', payment)
  if (status) qs.set('status', status)
  const { data, error, loading, reload } = useApi(`/studexa/students?${qs}`)
  const { data: me } = useApi('/studexa/me')
  const { data: terms } = useApi('/studexa/terms')
  const tableQ = term ? `?term=${encodeURIComponent(term)}` : ''
  const { data: table, reload: reloadTable } = useApi(`/studexa/class-table${tableQ}`)
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [newGroup, setNewGroup] = useState('')
  const [notice, setNotice] = useState(null)
  const [del, setDel] = useState(null)
  const [approveSel, setApproveSel] = useState({})
  const uni = me?.teacher?.schoolType === 'UNIVERSITY'

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next)
  }

  async function createGroup(e) {
    e.preventDefault()
    try {
      const g = await api('/studexa/groups', { method: 'POST', body: { name: newGroup } })
      navigate(`/studexa/groups/${encodeURIComponent(g.name)}`)
    } catch (err) {
      setNotice(err.message)
    }
  }

  async function approve(jr) {
    try {
      await api(`/studexa/join-requests/${jr.id}/approve`, {
        method: 'POST',
        body: { studentId: approveSel[jr.id] ?? 'new' },
      })
      show('Хүсэлт батлагдлаа')
      reload()
      reloadTable()
    } catch (err) {
      show(err.message, { type: 'error' })
    }
  }

  async function reject(jr) {
    await api(`/studexa/join-requests/${jr.id}/reject`, { method: 'POST' }).catch(() => {})
    reload()
  }

  /** CSV импорт — толгой: нэр, бүлэг, утас, аавын нэр, аавын утас, ээжийн нэр, ээжийн утас, төрсөн огноо, хүйс, регистр, хаяг */
  async function importCsv(file) {
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const r = await apiUpload('/studexa/students/import', { file })
      setImportResult(r)
      show(`${r.created} сурагч нэмэгдлээ`)
      reload()
      reloadTable()
    } catch (err) {
      show(err.message, { type: 'error' })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function remove() {
    try {
      await api(`/studexa/students/${del.id}`, { method: 'DELETE' })
      show('Сурагч устгагдлаа')
      setDel(null)
      reload()
      reloadTable()
    } catch (err) {
      show(err.message, { type: 'error' })
    }
  }

  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  return (
    <div className="space-y-6">
      <PageHead
        title="Сурагчдын жагсаалт"
        actions={
          <>
            <Link to="/studexa/attendance" className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted">📋 Ирц бүртгэх</Link>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => importCsv(e.target.files?.[0])} />
            <Button variant="ghost" loading={importing} onClick={() => fileRef.current?.click()} title="CSV толгой: нэр, бүлэг, утас, аавын нэр, аавын утас, ээжийн нэр, ээжийн утас, төрсөн огноо, хүйс, регистр, хаяг">⬆ CSV импорт</Button>
            <Button onClick={() => navigate('/studexa/students/new')}>+ Сурагч нэмэх</Button>
          </>
        }
      />
      {notice && <Notice tone="error">{notice}</Notice>}
      {importResult && (
        <Notice tone={importResult.skipped.length ? 'error' : 'ok'}>
          ✓ {importResult.created} сурагч нэмэгдлээ.
          {importResult.skipped.length > 0 && (
            <> Алгассан {importResult.skipped.length} мөр: {importResult.skipped.slice(0, 5).map((s) => `${s.line}-р мөр — ${s.reason}`).join('; ')}{importResult.skipped.length > 5 ? ' …' : ''}</>
          )}
        </Notice>
      )}

      {data.joinRequests.length > 0 && (
        <Card title="🔔 Элсэх хүсэлтүүд">
          <ul className="divide-y divide-rule">
            {data.joinRequests.map((jr) => (
              <li key={jr.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1 min-w-48">
                  <b>{jr.user.fullName || jr.user.username}</b>{' '}
                  <span className="text-ink-muted">({jr.user.username})</span>
                </span>
                <select
                  className={`${inputCls} w-auto`}
                  value={approveSel[jr.id] ?? 'new'}
                  onChange={(e) => setApproveSel({ ...approveSel, [jr.id]: e.target.value })}
                >
                  <option value="new">➕ Шинэ сурагч болгож нэмэх</option>
                  {data.linkableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.group || 'бүлэггүй'})-тэй холбох
                    </option>
                  ))}
                </select>
                <Button onClick={() => approve(jr)}>✓ Зөвшөөрөх</Button>
                <Button variant="ghost" onClick={() => reject(jr)}>Татгалзах</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.groupCards.map((g) => (
          <Link key={g.group} to={`/studexa/groups/${encodeURIComponent(g.group)}`} className="bg-surface border border-rule rounded-lg p-4 hover:border-ink-muted">
            <p className="text-xl">📁</p>
            <p className="mt-1 font-medium truncate">{g.group}</p>
            <p className="text-xs text-ink-muted">{g.n} сурагч</p>
          </Link>
        ))}
        {data.ungroupedCount > 0 && (
          <button type="button" onClick={() => setParam('group', '__none__')} className="text-left bg-surface border border-rule rounded-lg p-4 hover:border-ink-muted">
            <p className="text-xl">📂</p>
            <p className="mt-1 font-medium">Бүлэггүй сурагчид</p>
            <p className="text-xs text-ink-muted">{data.ungroupedCount} сурагч — бүлэгт хуваарилагдаагүй</p>
          </button>
        )}
        <form onSubmit={createGroup} className="bg-surface border border-dashed border-rule rounded-lg p-4">
          <p className="text-sm font-medium">➕ Бүлэг үүсгэх</p>
          <div className="mt-2 flex gap-2">
            <input className={inputCls} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="ж: 10а" required maxLength={100} />
            <Button type="submit">Үүсгэх</Button>
          </div>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input className={`${inputCls} w-56`} placeholder="Хайлт хийх..." defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && setParam('q', e.target.value)} />
        <select className={`${inputCls} w-auto`} value={group} onChange={(e) => setParam('group', e.target.value)}>
          <option value="">Бүх бүлэг</option>
          <option value="__none__">📂 Бүлэггүй</option>
          {data.groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {!uni && (
          <select className={`${inputCls} w-auto`} value={payment} onChange={(e) => setParam('payment', e.target.value)}>
            <option value="">Төлбөр (бүгд)</option>
            <option value="PAID">Төлсөн</option>
            <option value="OVERDUE">Хоцорсон</option>
          </select>
        )}
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setParam('status', e.target.value)} title="Төгссөн/шилжсэн сурагч default-аар нуугдана">
          <option value="">Суралцаж буй</option>
          <option value="GRADUATED">Төгссөн</option>
          <option value="LEFT">Шилжсэн</option>
          <option value="ALL">Бүгд (төгссөн, шилжсэн хамт)</option>
        </select>
        <span className="text-xs text-ink-muted ml-auto">{data.total} сурагч</span>
      </div>

      <Card>
        {data.items.length === 0 ? (
          <p className="text-sm text-ink-muted">Сурагч олдсонгүй.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
                  <th className="text-left py-2 pr-3 font-normal">Нэр</th>
                  {uni && <th className="text-left py-2 px-2 font-normal">Оюутны код</th>}
                  <th className="text-left py-2 px-2 font-normal">Бүлэг</th>
                  <th className="text-right py-2 px-2 font-normal">Ирц</th>
                  {!uni && <th className="text-left py-2 px-2 font-normal">Төлбөр</th>}
                  <th className="text-left py-2 px-2 font-normal">Утас</th>
                  <th className="text-left py-2 px-2 font-normal">Акаунт</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className="border-b border-rule">
                    <td className="py-2 pr-3 font-medium">
                      <Link className="hover:text-accent" to={`/studexa/students/${s.id}`}>{s.name}</Link>
                    </td>
                    {uni && <td className="py-2 px-2 font-mono">{s.studentCode || '—'}</td>}
                    <td className="py-2 px-2">{s.group || <span className="text-ink-muted">—</span>}{s.status !== 'ACTIVE' && <> <Pill item={STUDENT_STATUS[s.status]} /></>}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">{s.attendance}%</td>
                    {!uni && <td className="py-2 px-2"><Pill item={PAY_STATUS[s.paymentStatus]} /></td>}
                    <td className="py-2 px-2 font-mono">{s.phone || '—'}</td>
                    <td className="py-2 px-2 text-xs text-ink-muted">{s.user ? `🔗 ${s.user.username}` : '—'}</td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      <Link className="text-ink-muted hover:text-ink mr-3" to={`/studexa/students/${s.id}/edit`}>Засах</Link>
                      <button type="button" className="text-alarm/80 hover:text-alarm" onClick={() => setDel(s)}>Устгах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.total > data.limit && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <Button variant="ghost" disabled={page <= 1} onClick={() => { const n = new URLSearchParams(params); n.set('page', String(page - 1)); setParams(n) }}>←</Button>
            <span className="font-mono text-xs text-ink-muted">{page} / {Math.ceil(data.total / data.limit)}</span>
            <Button variant="ghost" disabled={page * data.limit >= data.total} onClick={() => { const n = new URLSearchParams(params); n.set('page', String(page + 1)); setParams(n) }}>→</Button>
          </div>
        )}
      </Card>

      <Card
        title="Дүнгийн нэгтгэл (өөрийн тохируулсан баганаар)"
        action={
          <>
            {(terms ?? []).length > 0 && (
              <select className={`${inputCls} w-auto`} value={term} onChange={(e) => setParam('term', e.target.value)} title="Улирлаар шүүх">
                <option value="">Бүх улирал</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.isCurrent ? '● ' : ''}{t.name}</option>)}
              </select>
            )}
            <Button variant="ghost" onClick={() => downloadFile(`/studexa/export/gradebook.csv${tableQ}`, 'negtgel.csv').catch((e) => show(e.message, { type: 'error' }))}>⬇ CSV</Button>
            <Button onClick={() => navigate(`/studexa/gradebook${tableQ}`)}>✎ Нэгтгэл засах</Button>
          </>
        }
      >
        <ClassTable table={table} />
      </Card>

      <ConfirmDialog
        open={Boolean(del)}
        title="Сурагч устгах"
        message={del ? `«${del.name}» сурагчийн даалгавар, дүн, төлбөрийн бүх мэдээлэл хамт устана. Устгах уу?` : ''}
        confirmLabel="Тийм, устгах"
        danger
        onConfirm={remove}
        onCancel={() => setDel(null)}
      />
    </div>
  )
}
