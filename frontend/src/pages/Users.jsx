import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
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

const ROLE_COLORS = {
  ADMIN: 'oklch(0.62 0.15 20)',
  MANAGER: 'oklch(0.62 0.12 250)',
  OPERATOR: 'oklch(0.60 0.13 155)',
  DRIVER: 'oklch(0.68 0.13 80)',
}
const ROLE_LABELS = {
  ADMIN: 'Админ',
  MANAGER: 'Менежер',
  OPERATOR: 'Харилцагч', // бараа нийлүүлдэг түнш — захиалга шивэх эрхтэй
  DRIVER: 'Жолооч',
}

function RoleBadge({ role, t }) {
  const color = ROLE_COLORS[role] ?? 'var(--color-ink-muted)'
  return (
    <span
      className="inline-flex font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5"
      style={{
        color,
        borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
      }}
    >
      {t(ROLE_LABELS[role] ?? role)}
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
    feePerDelivery: '3000.00',
    vehicleInfo: '',
  })
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))
  const isDriver = values.role === 'DRIVER'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
          ...(isDriver
            ? {
                feePerDelivery: String(values.feePerDelivery).trim(),
                ...(values.vehicleInfo.trim()
                  ? { vehicleInfo: values.vehicleInfo.trim() }
                  : {}),
              }
            : {}),
        })
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
        <option value="OPERATOR">{t('Харилцагч')}</option>
        <option value="MANAGER">{t('Менежер')}</option>
        <option value="DRIVER">{t('Жолооч')}</option>
        <option value="ADMIN">{t('Админ')}</option>
      </Select>
      {isDriver && (
        <>
          <Input
            id="u-fee"
            label={t('Хүргэлтийн хөлс (₮)')}
            required
            inputMode="decimal"
            pattern="\d{1,10}(\.\d{1,2})?"
            value={values.feePerDelivery}
            onChange={set('feePerDelivery')}
            className="font-mono"
          />
          <Input
            id="u-vehicle"
            label={t('Тээврийн хэрэгсэл')}
            value={values.vehicleInfo}
            onChange={set('vehicleInfo')}
            placeholder="Prius 30"
          />
        </>
      )}
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


/** Хэрэглэгч засах: эрх солих + жолоочийн хөлс/тээвэр */
function UserEditModal({ user, self, onClose, onDone, t, toast }) {
  const [role, setRole] = useState(user.role)
  const [fee, setFee] = useState(user.driverProfile?.feePerDelivery ?? '3000.00')
  const [vehicle, setVehicle] = useState(user.driverProfile?.vehicleInfo ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const isDriver = role === 'DRIVER'

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api(`/users/${user.id}`, {
        method: 'PATCH',
        body: {
          ...(role !== user.role ? { role } : {}),
          ...(isDriver
            ? {
                feePerDelivery: String(fee).trim(),
                ...(vehicle.trim() ? { vehicleInfo: vehicle.trim() } : {}),
              }
            : {}),
        },
      })
      toast.show(t('Хэрэглэгч шинэчлэгдлээ'))
      onDone()
    } catch (err) {
      setError(err.message)
      toast.show(err.message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${t('Засах')} — ${user.fullName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          id="ue-role"
          label={t('Эрх')}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={self}
        >
          <option value="OPERATOR">{t('Харилцагч')}</option>
          <option value="MANAGER">{t('Менежер')}</option>
          <option value="DRIVER">{t('Жолооч')}</option>
          <option value="ADMIN">{t('Админ')}</option>
        </Select>
        {isDriver && (
          <>
            <Input
              id="ue-fee"
              label={t('Хүргэлтийн хөлс (₮)')}
              required
              inputMode="decimal"
              pattern="\d{1,10}(\.\d{1,2})?"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="font-mono"
            />
            <Input
              id="ue-vehicle"
              label={t('Тээврийн хэрэгсэл')}
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </>
        )}
        {error && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('Болих')}
          </Button>
          <Button type="submit" loading={submitting}>
            {t('Хадгалах')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Users() {
  const { user: me, hasPerm } = useAuth()
  // Backend нь /users/:id/permissions дээр users.manage БА permissions.manage
  // хоёуланг шаардана — эрхгүй хүнд товчийг харуулбал 403 иднэ
  const canManagePerms = hasPerm('permissions.manage')
  const toast = useToast()
  const { t } = useLang()
  const navigate = useNavigate()

  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deactivating, setDeactivating] = useState(null)
  const [editing, setEditing] = useState(null)
  const [resetting, setResetting] = useState(null) // сэргээх гэж буй хэрэглэгч
  const [tempResult, setTempResult] = useState(null) // {name, tempPassword}
  const [copied, setCopied] = useState(false)

  // "Жолооч нар" цэс /users?role=DRIVER-ээр ирдэг
  const [params] = useSearchParams()
  const roleFilter = params.get('role')

  const load = useCallback(() => {
    setError(null)
    api(roleFilter ? `/users?role=${roleFilter}` : '/users')
      .then(setUsers)
      .catch((e) => setError(e))
  }, [roleFilter])

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

  /** V4-06: түр нууц үг үүсгээд НЭГ УДАА харуулна */
  async function resetPassword() {
    setBusy(true)
    try {
      const res = await api(`/users/${resetting.id}/reset-password`, {
        method: 'POST',
      })
      setTempResult({ name: resetting.fullName, tempPassword: res.tempPassword })
      setCopied(false)
      setResetting(null)
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function copyTemp() {
    try {
      await navigator.clipboard.writeText(tempResult.tempPassword)
      setCopied(true)
    } catch {
      toast.show(t('Хуулж чадсангүй — гараар хуулна уу'), { type: 'error' })
    }
  }

  const isLocked = (u) => u.lockedUntil && new Date(u.lockedUntil) > new Date()

  async function unlock(u) {
    setBusy(true)
    try {
      await api(`/users/${u.id}/unlock`, { method: 'PATCH' })
      toast.show(t('«{name}»-ийн түгжээ тайлагдлаа', { name: u.fullName }))
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'fullName',
      header: t('Нэр'),
      render: (u) => (
        <span className="inline-flex items-center gap-2">
          {u.fullName}
          {isLocked(u) && (
            <span className="font-mono text-[10px] uppercase border rounded px-1 py-0.5 text-alarm border-alarm/40 bg-alarm/10">
              {t('Түгжээтэй')}
            </span>
          )}
        </span>
      ),
    },
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
      key: 'lastLoginAt',
      header: t('Сүүлд нэвтэрсэн'),
      render: (u) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}
        </span>
      ),
    },
    {
      key: 'fee',
      header: t('Хөлс'),
      align: 'right',
      render: (u) => (
        <span className="font-mono text-sm tabular-nums text-ink-muted">
          {u.driverProfile ? u.driverProfile.feePerDelivery : '—'}
        </span>
      ),
    },
    {
      key: '_edit',
      header: '',
      render: (u) => (
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(u)}
            className="text-xs text-ink-muted hover:text-ink"
          >
            {t('Засах')}
          </button>
          {canManagePerms && (
            <button
              type="button"
              onClick={() => navigate(`/users/${u.id}/permissions`)}
              className="text-xs text-accent hover:underline underline-offset-2"
            >
              {t('Эрхүүд')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setResetting(u)}
            className="text-xs text-ink-muted hover:text-alarm"
          >
            {t('Нууц үг сэргээх')}
          </button>
          {isLocked(u) && (
            <button
              type="button"
              onClick={() => unlock(u)}
              className="text-xs text-alarm hover:underline underline-offset-2"
            >
              {t('Түгжээ тайлах')}
            </button>
          )}
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
        <h1 className="font-serif text-4xl font-medium">
          {t(roleFilter === 'DRIVER' ? 'Жолооч нар' : 'Хэрэглэгчид')}
        </h1>
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

      {editing && (
        <UserEditModal
          user={editing}
          self={editing.id === me?.id}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            load()
          }}
          t={t}
          toast={toast}
        />
      )}

      <ConfirmDialog
        open={!!resetting}
        title={t('Нууц үг сэргээх')}
        message={t(
          '«{name}»-д шинэ түр нууц үг үүсгэнэ. Хуучин нууц үг нь ажиллахаа болино. Үргэлжлүүлэх үү?',
          { name: resetting?.fullName },
        )}
        confirmLabel={t('Сэргээх')}
        danger
        loading={busy}
        onConfirm={resetPassword}
        onCancel={() => setResetting(null)}
      />

      {/* Түр нууц үг — ЗӨВХӨН энэ modal-д нэг удаа харагдана */}
      <Modal
        open={!!tempResult}
        onClose={() => setTempResult(null)}
        title={t('Түр нууц үг')}
      >
        {tempResult && (
          <div className="space-y-4">
            <p className="text-sm">
              {t(
                '«{name}»-ийн түр нууц үг. Энэ цонхыг хаасны дараа ДАХИН харагдахгүй — хуулж аваад хэрэглэгчид дамжуулна уу.',
                { name: tempResult.name },
              )}
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 font-mono text-xl tracking-wider border border-rule rounded px-4 py-2 text-center select-all">
                {tempResult.tempPassword}
              </code>
              <Button variant="ghost" onClick={copyTemp}>
                {copied ? t('Хуулагдлаа ✓') : t('Хуулах')}
              </Button>
            </div>
            <p className="text-xs text-ink-muted">
              {t(
                'Хэрэглэгч түр нууц үгээр нэвтрээд шинэ нууц үг зохиох хүртэл систем түгжээтэй байна.',
              )}
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setTempResult(null)}>{t('Хаах')}</Button>
            </div>
          </div>
        )}
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
