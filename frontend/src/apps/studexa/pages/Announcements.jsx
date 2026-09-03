import { useState } from 'react'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, inputCls, Loading, LoadError, PageHead, Pill } from '../components/ui'
import { fmtDateTime } from '../lib/labels'
import { useApi } from '../lib/useApi'

/** Багшийн зарлалын feed */
export default function Announcements() {
  const { show } = useToast()
  const { data, error, loading, reload } = useApi('/studexa/announcements')
  const [text, setText] = useState('')
  const [group, setGroup] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api('/studexa/announcements', { method: 'POST', body: { text, group } })
      setText('')
      show('Зарлал нийтлэгдлээ — холбогдсон сурагчдад мэдэгдэл очно')
      reload()
    } catch (err) {
      show(err.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  return (
    <div className="space-y-5">
      <PageHead title="📢 Зарлал" />
      <Card title="Шинэ зарлал нийтлэх">
        <form onSubmit={submit} className="space-y-3">
          <textarea className={inputCls} rows={3} value={text} onChange={(e) => setText(e.target.value)} required maxLength={4000} placeholder="Зарлалаа бичнэ үү... (ж: Маргааш 10:00 цагт сорил авна, бэлтгэлтэй ирээрэй)" />
          <div className="flex gap-2">
            <select className={`${inputCls} w-auto`} value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">👥 Бүх бүлэгт</option>
              {data.groups.map((g) => <option key={g} value={g}>📁 {g}</option>)}
            </select>
            <Button type="submit" loading={saving}>📢 Нийтлэх</Button>
          </div>
        </form>
      </Card>
      {data.items.length === 0 && <Card><p className="text-sm text-ink-muted">Зарлал алга. Дээрх талбараас эхний зарлалаа нийтлээрэй.</p></Card>}
      {data.items.map((a) => (
        <Card key={a.id}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs text-ink-muted flex items-center gap-2">
              {fmtDateTime(a.createdAt)}
              {a.group ? <Pill>📁 {a.group}</Pill> : <Pill item={{ label: '👥 Бүх бүлэг', cls: 'text-safe border-safe/40 bg-safe/12' }} />}
            </span>
            <button type="button" className="text-ink-muted hover:text-alarm" title="Зарлалыг устгах" onClick={() => api(`/studexa/announcements/${a.id}`, { method: 'DELETE' }).then(reload)}>✕</button>
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap">{a.text}</p>
        </Card>
      ))}
    </div>
  )
}
