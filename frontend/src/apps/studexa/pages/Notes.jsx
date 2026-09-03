import { useState } from 'react'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { useToast } from '../../../components/ui/Toast'
import { api } from '../../../lib/api'
import { Card, Field, inputCls, Loading, LoadError, PageHead } from '../components/ui'
import { fmtDateTime } from '../lib/labels'
import { useApi } from '../lib/useApi'

/** Багшийн тэмдэглэлүүд */
export default function Notes() {
  const { show } = useToast()
  const { data, error, loading, reload } = useApi('/studexa/notes')
  const [edit, setEdit] = useState(null)
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api(edit.id ? `/studexa/notes/${edit.id}` : '/studexa/notes', { method: edit.id ? 'PATCH' : 'POST', body: { title: edit.title, text: edit.text } })
      setEdit(null)
      show('Хадгалагдлаа')
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
      <PageHead title="Тэмдэглэлүүд" actions={<Button onClick={() => setEdit({ title: '', text: '' })}>+ Тэмдэглэл нэмэх</Button>} />
      <Card>
        {data.length === 0 ? (
          <p className="text-sm text-ink-muted">Тэмдэглэл алга.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {data.map((n) => (
              <li key={n.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{n.title}</span>
                  <span className="flex items-center gap-3 text-xs text-ink-muted">
                    {fmtDateTime(n.createdAt)}
                    <button type="button" className="hover:text-ink" onClick={() => setEdit(n)}>✎</button>
                    <button type="button" className="hover:text-alarm" onClick={() => api(`/studexa/notes/${n.id}`, { method: 'DELETE' }).then(reload)}>✕</button>
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted whitespace-pre-wrap">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Тэмдэглэл засах' : 'Тэмдэглэл нэмэх'}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Болих</Button><Button loading={saving} onClick={save}>Хадгалах</Button></>}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            <Field label="Гарчиг"><input className={inputCls} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required maxLength={100} /></Field>
            <Field label="Тэмдэглэл"><textarea className={inputCls} rows={4} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} required maxLength={4000} /></Field>
          </form>
        )}
      </Modal>
    </div>
  )
}
