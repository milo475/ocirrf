import { useCallback, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

function RoleBadge({ role, t }) {
  return (
    <span className="inline-flex font-mono text-[11px] uppercase tracking-wide border border-rule rounded px-1.5 py-0.5 text-ink-muted">
      {role === 'ADMIN' ? t('Админ') : t('Оператор')}
    </span>
  )
}

/** isActive switch — өөрийн мөрөнд disabled */
function ActiveToggle({ checked, disabled, onChange, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      title={disabled ? title : undefined}
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

function UserForm({ submitting, error, onSubmit, onCancel, t }) {
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
        label={t('Нэр')}
        required
        minLength={2}
        value={values.name}
        onChange={set('name')}
        placeholder={t('Бүтэн нэр')}
      />
      <Input
        id="u-email"
        label={t('Имэйл')}
        type="email"
        required
        value={values.email}
        onChange={set('email')}
        placeholder="ajiltan@ursgal.mn"
      />
      <Input
        id="u-password"
        label={t('Нууц үг')}
        type="password"
        required
        minLength={6}
        value={values.password}
        onChange={set('password')}
        placeholder={t('Хамгийн багадаа 6 тэмдэгт')}
      />
      <Select id="u-role" label={t('Эрх')} value={values.role} onChange={set('role')}>
        <option value="OPERATOR">{t('Оператор')}</option>
        <option value="ADMIN">{t('Админ')}</option>
      </Select>
      {error && (
        <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          {t('Болих')}
        </Button>
        <Button type="submit" loading={submitting}>
          {t('Бүртгэх')}
        </Button>
      </div>
    </form>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const toast = useToast()
  const { t } = useLang()

  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deactivating, setDeactivating] = useState(null)

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
    setFormError(null)
    try {
      await api('/users', { method: 'POST', body: values })
      toast.show(t('«{name}» бүртгэгдлээ', { name: values.name }))
      setFormOpen(false)
      load()
    } catch (e) {
      setFormError(e.message) // форм дотроо талбарын доор
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function setActive(u, isActive) {
    setBusy(true)
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: { isActive } })
      toast.show(
        isActive
          ? t('«{name}» идэвхжлээ', { name: u.fullName })
          : t('«{name}» идэвхгүй боллоо', { name: u.fullName }),
      )
      setDeactivating(null)
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Идэвхгүй болгоход баталгаажуулна; идэвхжүүлэх нь шууд */
  function toggleActive(u) {
    if (u.isActive) setDeactivating(u)
    else setActive(u, true)
  }

  const columns = [
    { key: 'fullName', header: t('Нэр') },
    {
      key: 'username',
      header: t('Имэйл'),
      render: (u) => <span className="font-mono text-sm">{u.username}</span>,
    },
    {
      key: 'role',
      header: t('Эрх'),
      render: (u) => <RoleBadge role={u.role} t={t} />,
    },
    {
      key: 'createdAt',
      header: t('Бүртгэсэн'),
      render: (u) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {formatDateTime(u.createdAt)}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: t('Идэвхтэй'),
      render: (u) => (
        <ActiveToggle
          checked={u.isActive}
          disabled={u.id === me?.id}
          title={t('Өөрийгөө идэвхгүй болгох боломжгүй')}
          onChange={() => toggleActive(u)}
        />
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">{t('Хэрэглэгчид')}</h1>
        <Button onClick={() => setFormOpen(true)}>{t('+ Шинэ хэрэглэгч')}</Button>
      </div>

      <div className="mt-8">
        {error ? (
          <EmptyState
            title={t('Жагсаалт ачаалж чадсангүй')}
            note={error.message}
            action={<Button onClick={load}>{t('Дахин оролдох')}</Button>}
          />
        ) : !users ? (
          <div className="py-16 text-center">
            <Spinner size={22} />
          </div>
        ) : (
          <Table columns={columns} rows={users} empty={t('Хэрэглэгч алга')} />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setFormError(null)
        }}
        title={t('Шинэ хэрэглэгч')}
      >
        <UserForm
          t={t}
          submitting={busy}
          error={formError}
          onSubmit={handleCreate}
          onCancel={() => {
            setFormOpen(false)
            setFormError(null)
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deactivating}
        title={t('Хэрэглэгч идэвхгүй болгох')}
        message={t('«{name}» цаашид нэвтэрч чадахгүй болно. Идэвхгүй болгох уу?', { name: deactivating?.fullName })}
        confirmLabel={t('Идэвхгүй болгох')}
        danger
        loading={busy}
        onConfirm={() => setActive(deactivating, false)}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  )
}
