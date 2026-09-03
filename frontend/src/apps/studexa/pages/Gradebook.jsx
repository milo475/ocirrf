import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, inputCls, Loading, LoadError, PageHead } from '../components/ui'
import { useApi } from '../lib/useApi'

/** Дүнгийн нэгтгэл — Excel шиг шууд засах горим */
export default function Gradebook() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [params] = useSearchParams()
  const group = params.get('group') ?? ''
  const qs = group ? `?group=${encodeURIComponent(group)}` : ''
  const { data, error, loading, reload } = useApi(`/studexa/gradebook${qs}`)
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  return (
    <div className="space-y-5">
      <PageHead
        title="Дүнгийн нэгтгэл засах"
        sub={group ? `📁 ${group}` : 'Нүд болон баганын нэрэнд шууд бичнэ · Оноог хоосолбол устгана · Баганын /тоо хэсгээр дээд оноог өөрчилнө'}
        actions={<Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to={`/studexa/students/new${qs}`}>+ Сурагч нэмэх</Link>}
      />
      {/* key: сервер өгөгдөл шинэчлэгдэх бүрт засварын төлөв дахин эхэлнэ */}
      <GradebookEditor key={JSON.stringify(data.columns) + data.rows.length} data={data} qs={qs} group={group} reload={reload} navigate={navigate} show={show} />
    </div>
  )
}

function GradebookEditor({ data, qs, group, reload, navigate, show }) {
  const [cols, setCols] = useState(() => data.columns.map((c) => ({ ...c })))
  const [cells, setCells] = useState(() => {
    const c = {}
    for (const r of data.rows) for (const cell of r.cells) c[`${cell.columnId}|${r.student.id}`] = cell.value === null ? '' : String(cell.value)
    return c
  })
  const [att, setAtt] = useState(() => Object.fromEntries(data.rows.map((r) => [r.student.id, String(r.att)])))
  const [hw, setHw] = useState(() => Object.fromEntries(data.rows.map((r) => [r.student.id, r.hw === null ? '' : String(r.hw)])))
  const [newCol, setNewCol] = useState(null)
  const [delCol, setDelCol] = useState(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const body = {
        columns: cols.map((c) => ({ id: c.id, name: c.name, maxScore: Number(c.maxScore) || undefined })),
        cells: Object.entries(cells).map(([k, v]) => { const [columnId, studentId] = k.split('|'); return { columnId, studentId, value: v } }),
        attendance: Object.entries(att).map(([studentId, value]) => ({ studentId, value })),
        hwPercent: Object.entries(hw).map(([studentId, value]) => ({ studentId, value })),
      }
      const r = await api(`/studexa/gradebook${qs}`, { method: 'POST', body })
      show(`Хадгалагдлаа (${r.changed} өөрчлөлт)`)
      reload()
    } catch (e) {
      show(e.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function addColumn(e) {
    e.preventDefault()
    try {
      await api('/studexa/gradebook/columns', { method: 'POST', body: { name: newCol.name, maxScore: Number(newCol.max) || 100 } })
      setNewCol(null)
      reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    }
  }

  return (
    <div className="space-y-5">
      {cols.length === 0 && (
        <div className="border border-rule rounded-lg p-4 text-sm text-ink-muted bg-surface">
          🎉 <b>Тавтай морил! Дүнгийн хүснэгтээ өөрөө байгуулаарай.</b> Хүснэгтийн баруун захын <b>➕</b> товчийг дараад
          баганынхаа нэрийг бичнэ (ж: Даалгавар 1), хажууд нь дээд оноог нь тохируулна (ж: 5).
        </div>
      )}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
                <th className="text-left py-2 pr-3 font-normal">Сурагчийн нэр</th>
                <th className="text-left py-2 px-2 font-normal">Ирц %</th>
                <th className="text-left py-2 px-2 font-normal">Даалгавар %</th>
                {cols.map((c, i) => (
                  <th key={c.id} className="py-2 px-2 font-normal min-w-32">
                    <div className="flex items-center gap-1">
                      <input className={`${inputCls} py-1`} value={c.name} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <button type="button" className="text-ink-muted hover:text-alarm" title="Баганыг бүх оноотой нь устгах" onClick={() => setDelCol(c)}>✕</button>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-ink-muted">
                      /<input type="number" min={1} max={1000} className={`${inputCls} py-1 w-20`} value={c.maxScore} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, maxScore: e.target.value } : x)))} />
                    </div>
                  </th>
                ))}
                <th className="py-2 pl-2 font-normal">
                  {newCol ? (
                    <form onSubmit={addColumn} className="flex items-center gap-1">
                      <input className={`${inputCls} py-1 w-32`} placeholder="Баганын нэр" value={newCol.name} onChange={(e) => setNewCol({ ...newCol, name: e.target.value })} autoFocus required />
                      <input type="number" className={`${inputCls} py-1 w-20`} min={1} max={1000} value={newCol.max} onChange={(e) => setNewCol({ ...newCol, max: e.target.value })} />
                      <Button type="submit">✓</Button>
                      <Button variant="ghost" onClick={() => setNewCol(null)}>✕</Button>
                    </form>
                  ) : (
                    <Button variant="ghost" onClick={() => setNewCol({ name: '', max: 100 })} title="Шинэ багана нэмэх">+</Button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.student.id} className="border-b border-rule">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Link className="hover:text-accent" to={`/studexa/students/${r.student.id}`}>{r.student.name}</Link>
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" min={0} max={100} className={`${inputCls} py-1 w-20`} value={att[r.student.id] ?? ''} disabled={r.attAuto}
                      title={r.attAuto ? 'Ирцийн бүртгэлээс автоматаар тооцогдоно' : 'Ирцийн бүртгэл эхэлмэгц автоматаар тооцогдоно'}
                      onChange={(e) => setAtt({ ...att, [r.student.id]: e.target.value })} />
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" min={0} max={100} className={`${inputCls} py-1 w-20`} placeholder="авто" value={hw[r.student.id] ?? ''} onChange={(e) => setHw({ ...hw, [r.student.id]: e.target.value })} />
                  </td>
                  {cols.map((c) => {
                    const k = `${c.id}|${r.student.id}`
                    return (
                      <td key={c.id} className="py-2 px-2">
                        <input type="number" min={0} max={c.maxScore} className={`${inputCls} py-1 w-20`} placeholder="—" value={cells[k] ?? ''} onChange={(e) => setCells({ ...cells, [k]: e.target.value })} />
                      </td>
                    )
                  })}
                  <td />
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr><td colSpan={4 + cols.length} className="py-6 text-center text-ink-muted">Сурагч алга. «+ Сурагч нэмэх» товчоор нэмнэ үү.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex gap-2">
        <Button onClick={save} loading={saving}>💾 Хадгалах</Button>
        <Button variant="ghost" onClick={() => navigate(group ? `/studexa/groups/${encodeURIComponent(group)}` : '/studexa/students')}>Болих</Button>
      </div>
      <p className="text-xs text-ink-muted">Даалгавар % хоосон бол даалгаврын бүртгэлээс автоматаар тооцно. Шинэ нүдэнд бичсэн оноо өнөөдрийн огноогоор хадгалагдана. Дээд оноог багасгахад түүнээс их оноонууд хумигдана.</p>
      <ConfirmDialog open={Boolean(delCol)} title="Багана устгах" message={delCol ? `«${delCol.name}» баганыг бүх оноотой нь устгах уу?` : ''} danger confirmLabel="Устгах"
        onConfirm={async () => { await api(`/studexa/gradebook/columns/${delCol.id}`, { method: 'DELETE' }).catch((e) => show(e.message, { type: 'error' })); setDelCol(null); reload() }}
        onCancel={() => setDelCol(null)} />
    </div>
  )
}
