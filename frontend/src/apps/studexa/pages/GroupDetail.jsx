import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Button from '../../../components/ui/Button'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import ClassTable from '../components/ClassTable'
import { Card, Loading, LoadError, Notice, PageHead, Pill } from '../components/ui'
import { PAY_STATUS } from '../lib/labels'
import { downloadFile, useApi } from '../lib/useApi'

/** Бүлгийн хуудас: сурагчид, нэмэх/хасах, нэгтгэл, татан буулгах */
export default function GroupDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const { data, error, loading, reload } = useApi(`/studexa/groups/${encodeURIComponent(name)}`)
  const { data: me } = useApi('/studexa/me')
  const [picked, setPicked] = useState([])
  const [dissolve, setDissolve] = useState(false)
  const [removed, setRemoved] = useState(null)
  const uni = me?.teacher?.schoolType === 'UNIVERSITY'
  const g = encodeURIComponent(name)

  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  async function addPicked(e) {
    e.preventDefault()
    try {
      const r = await api(`/studexa/groups/${g}/add`, { method: 'POST', body: { studentIds: picked } })
      setPicked([])
      show(`${r.count} сурагч нэмэгдлээ`)
      if (r.name !== name) navigate(`/studexa/groups/${encodeURIComponent(r.name)}`, { replace: true })
      else reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    }
  }

  async function removeStudent(s) {
    await api(`/studexa/groups/${g}/remove/${s.id}`, { method: 'POST' }).catch((e) => show(e.message, { type: 'error' }))
    setRemoved(s.name)
    reload()
  }

  return (
    <div className="space-y-6">
      <PageHead
        title={`📁 ${name} бүлэг`}
        sub={`${data.students.length} сурагч`}
        actions={
          <>
            <Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to={`/studexa/homework/new?group=${g}`}>✎ Даалгавар өгөх</Link>
            <Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to={`/studexa/schedule?group=${g}`}>🗓 Хуваарь</Link>
            <Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to={`/studexa/attendance?group=${g}`}>📋 Ирц бүртгэх</Link>
            <Link className="border border-rule rounded px-3 py-2 text-sm hover:border-ink-muted" to={`/studexa/gradebook?group=${g}`}>📊 Нэгтгэл засах</Link>
            <Button onClick={() => navigate(`/studexa/students/new?group=${g}`)}>+ Шинэ сурагч</Button>
          </>
        }
      />
      {removed && <Notice>✓ «{removed}» бүлгээс хасагдлаа — сурагч устаагүй, «Бүлэггүй сурагчид» хэсэгт очсон.</Notice>}

      <Card>
        {data.students.length === 0 ? (
          <p className="text-sm text-ink-muted">Энэ бүлэгт сурагч алга. Доорх хэсгээс нэмнэ үү.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
                  <th className="text-left py-2 pr-3 font-normal">Нэр</th>
                  {uni && <th className="text-left py-2 px-2 font-normal">Оюутны код</th>}
                  <th className="text-left py-2 px-2 font-normal">Утас</th>
                  {!uni && <th className="text-left py-2 px-2 font-normal">Төлбөр</th>}
                  <th className="text-right py-2 px-2 font-normal">Ирц</th>
                  <th className="text-left py-2 px-2 font-normal">Акаунт</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.id} className="border-b border-rule">
                    <td className="py-2 pr-3 font-medium"><Link className="hover:text-accent" to={`/studexa/students/${s.id}`}>{s.name}</Link></td>
                    {uni && <td className="py-2 px-2 font-mono">{s.studentCode || '—'}</td>}
                    <td className="py-2 px-2 font-mono">{s.phone || '—'}</td>
                    {!uni && <td className="py-2 px-2"><Pill item={PAY_STATUS[s.paymentStatus]} /></td>}
                    <td className="py-2 px-2 text-right font-mono">{s.attendance}%</td>
                    <td className="py-2 px-2 text-xs text-ink-muted">{s.user ? `🔗 ${s.user.username}` : '—'}</td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      <Link className="text-ink-muted hover:text-ink mr-3" to={`/studexa/students/${s.id}/edit`}>Засах</Link>
                      <button type="button" className="text-ink-muted hover:text-alarm" onClick={() => removeStudent(s)}>Бүлгээс хасах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data.available.length > 0 && (
        <Card title={`➕ Сурагч нэмэх (${data.available.length})`}>
          <form onSubmit={addPicked}>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto">
              {data.available.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm border border-rule rounded px-2 py-1.5">
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
                  <b className="truncate">{s.name}</b>
                  <span className="text-xs text-ink-muted ml-auto">{s.group || 'бүлэггүй'}</span>
                </label>
              ))}
            </div>
            <Button type="submit" className="mt-3" disabled={picked.length === 0}>Сонгосныг бүлэгт нэмэх</Button>
          </form>
        </Card>
      )}

      <Card
        title={`Дүнгийн нэгтгэл — ${name}`}
        action={
          <>
            <Button variant="ghost" onClick={() => downloadFile(`/studexa/export/gradebook.csv?group=${g}`, 'negtgel.csv').catch((e) => show(e.message, { type: 'error' }))}>⬇ CSV</Button>
            <Button onClick={() => navigate(`/studexa/gradebook?group=${g}`)}>✎ Нэгтгэл засах</Button>
          </>
        }
      >
        <ClassTable table={data.classTable} />
      </Card>

      <Card title="Бүлэг татан буулгах">
        <p className="text-sm text-ink-muted">Бүлгийг татан буулгахад сурагчид устахгүй — зөвхөн бүлэггүй болно.</p>
        <Button variant="danger" className="mt-3" onClick={() => setDissolve(true)}>Бүлэг татан буулгах</Button>
      </Card>
      <ConfirmDialog open={dissolve} title="Бүлэг татан буулгах" message={`«${name}» бүлгийг татан буулгах уу?`} danger confirmLabel="Тийм"
        onConfirm={async () => { await api(`/studexa/groups/${g}`, { method: 'DELETE' }); navigate('/studexa/students') }} onCancel={() => setDissolve(false)} />
    </div>
  )
}
