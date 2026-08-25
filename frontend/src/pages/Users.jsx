import { useCallback, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

function RoleBadge({ role }) {
  return (
    <span className="inline-flex font-mono text-[11px] uppercase tracking-wide border border-rule rounded px-1.5 py-0.5 text-ink-muted">
      {role === 'ADMIN' ? 'Админ' : 'Оператор'}
    </span>
  )
}

/** isActive switch — өөрийн мөрөнд disabled */
function ActiveToggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      title={disabled ? 'Өөрийгөө идэвхгүй болгох боломжгүй' : undefined}
      className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-safe' : 'bg-rule'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-bg transition-transform ${
          checked ? 'translate-x-4.5 left-0' : 'translate-x-0.5 left-0'
        }`}
      />
    </button>
  )
}

function UserForm({ submitting, onSubmit, onCancel }) {
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    role: 'OPERATOR',
  })
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(values)
      }}
      className="space-y-4"
    >
      <Input
        id="u-name"
        label="Нэр"
        required
        minLength={2}
        value={values.name}
        onChange={set('name')}
        placeholder="Бүтэн нэр"
      />
      <Input
        id="u-email"
        label="Имэйл"
        type="email"
        required
        value={values.email}
        onChange={set('email')}
        placeholder="ajiltan@ursgal.mn"
      />
      <Input
        id="u-password"
        label="Нууц үг"
        type="password"
        required
        minLength={6}
        value={values.password}
        onChange={set('password')}
        placeholder="Хамгийн багадаа 6 тэмдэгт"
      />
      <Select id="u-role" label="Эрх" value={values.role} onChange={set('role')}>
        <option value="OPERATOR">Оператор</option>
        <option value="ADMIN">Админ</option>
      </Select>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Болих
        </Button>
        <Button type="submit" loading={submitting}>
          Бүртгэх
        </Button>
      </div>
    </form>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const toast = useToast()

  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError(null)
    api('/users')
      .then(setUsers)
      .catch((e) => setError(e))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(values) {
    setBusy(true)
    try {
      await api('/users', { method: 'POST', body: values })
      toast.show(`«${values.name}» бүртгэгдлээ`)
      setFormOpen(false)
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(u) {
    try {
      await api(`/users/${u.id}`, {
        method: 'PATCH',
        body: { isActive: !u.isActive },
      })
      toast.show(
        u.isActive
          ? `«${u.fullName}» идэвхгүй боллоо`
          : `«${u.fullName}» идэвхжлээ`,
      )
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    }
  }

  const columns = [
    { key: 'fullName', header: 'Нэр' },
    {
      key: 'username',
      header: 'Имэйл',
      render: (u) => <span className="font-mono text-sm">{u.username}</span>,
    },
    {
      key: 'role',
      header: 'Эрх',
      render: (u) => <RoleBadge role={u.role} />,
    },
    {
      key: 'createdAt',
      header: 'Бүртгэсэн',
      render: (u) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {formatDateTime(u.createdAt)}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Идэвхтэй',
      render: (u) => (
        <ActiveToggle
          checked={u.isActive}
          disabled={u.id === me?.id}
          onChange={() => toggleActive(u)}
        />
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">Хэрэглэгчид</h1>
        <Button onClick={() => setFormOpen(true)}>+ Шинэ хэрэглэгч</Button>
      </div>

      <div className="mt-8">
        {error ? (
          <EmptyState
            title="Жагсаалт ачаалж чадсангүй"
            note={error.message}
            action={<Button onClick={load}>Дахин оролдох</Button>}
          />
        ) : !users ? (
          <div className="py-16 text-center">
            <Spinner size={22} />
          </div>
        ) : (
          <Table columns={columns} rows={users} empty="Хэрэглэгч алга" />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Шинэ хэрэглэгч"
      >
        <UserForm
          submitting={busy}
          onSubmit={handleCreate}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>
    </div>
  )
}
