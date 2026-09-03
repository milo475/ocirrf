import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { appIcon } from '../lib/appIcon'

const STATUS_LABELS = {
  ACTIVE: 'Идэвхтэй',
  COMING_SOON: 'Тун удахгүй',
  DISABLED: 'Унтраасан',
}

/**
 * ПЛАТФОРМЫН SUPERADMIN КОНСОЛ (Prompt 5).
 * Зөвхөн isSuperAdmin хэрэглэгчид — бусдад 404 маягийн хуудас
 * (ийм зам БАЙДАГ гэдгийг ч мэдэгдэхгүй).
 */
export default function PlatformAdmin() {
  const { user } = useAuth()
  const { t } = useLang()

  if (!user?.isSuperAdmin) {
    return (
      <main className="min-h-screen bg-bg text-ink flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-4xl text-ink-muted">404</p>
          <p className="mt-2 text-sm text-ink-muted">{t('Хуудас олдсонгүй')}</p>
        </div>
      </main>
    )
  }
  return <Console />
}

function Console() {
  const { t } = useLang()
  const [stats, setStats] = useState(null)
  const [orgs, setOrgs] = useState(null)
  const [apps, setApps] = useState(null)
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState(null) // {org, action}
  const [error, setError] = useState(null)

  /**
   * ХАЙЛТ: debounce + хоцорсон хариуны хамгаалалт (V5 засвар).
   *
   * Өмнө нь `useEffect(load, [search])` нь ҮСЭГ БҮРТ гурван хүсэлт
   * илгээдэг байсан: «acme» бичихэд 12 хүсэлт явж, хариунууд дараалалгүй
   * ирэхэд жагсаалт «ac»-ийн үр дүн дээр тогтож болдог байв. `stats` ба
   * `apps` нь хайлтаас огт хамаардаггүй атлаа мөн дахин татагддаг байсан.
   */
  const seq = useLatestRequest()

  // Хайлтаас хамаарахгүй өгөгдөл — нэг л удаа
  useEffect(() => {
    api('/platform/admin/stats').then(setStats).catch((e) => setError(e.message))
    api('/platform/admin/apps').then(setApps).catch((e) => setError(e.message))
  }, [])

  const loadOrgs = useCallback(() => {
    setError(null)
    const fresh = seq()
    api(
      `/platform/admin/organizations${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    )
      .then((d) => fresh() && setOrgs(d))
      .catch((e) => fresh() && setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    const id = setTimeout(loadOrgs, 300)
    return () => clearTimeout(id)
  }, [loadOrgs])

  /** Үйлдлийн дараа бүх хэсгийг сэргээнэ */
  const load = () => {
    api('/platform/admin/stats').then(setStats).catch((e) => setError(e.message))
    api('/platform/admin/apps').then(setApps).catch((e) => setError(e.message))
    loadOrgs()
  }

  async function doConfirm() {
    const { org, action } = confirm
    setConfirm(null)
    try {
      await api(`/platform/admin/organizations/${org.id}/${action}`, {
        method: 'PATCH',
      })
      load()
    } catch (e) {
      setError(e.message ?? 'Алдаа гарлаа')
    }
  }

  async function setAppStatus(app, status) {
    try {
      await api(`/platform/admin/apps/${app.id}`, {
        method: 'PATCH',
        body: { status },
      })
      load()
    } catch (e) {
      setError(e.message ?? 'Алдаа гарлаа')
    }
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="h-12 border-b border-rule flex items-center gap-3 px-4 md:px-6">
        <Link
          to="/launcher"
          className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={15} /> {t('Буцах')}
        </Link>
        <span className="font-serif text-lg font-medium ml-2">
          {t('Платформ удирдлага')}
        </span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {error && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* ── Тоон үзүүлэлт ── */}
        <section className="grid grid-cols-3 gap-4">
          {[
            ['Байгууллага', stats?.organizations],
            ['Хэрэглэгч', stats?.users],
            ['Идэвхтэй app', stats?.activeApps],
          ].map(([label, value]) => (
            <div key={label} className="border border-rule rounded-lg p-4 bg-surface">
              <p className="text-xs font-mono uppercase tracking-wide text-ink-muted">
                {t(label)}
              </p>
              <p className="mt-1 font-serif text-3xl">{value ?? '—'}</p>
            </div>
          ))}
        </section>

        {/* ── Байгууллагууд ── */}
        <section>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-xl font-medium">{t('Байгууллагууд')}</h2>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Нэрээр хайх…')}
                className="bg-bg border border-rule rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-ink-muted"
              />
            </div>
          </div>
          <div className="mt-4 border border-rule rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-mono uppercase tracking-wide text-ink-muted border-b border-rule">
                  <th className="px-4 py-2.5">{t('Нэр')}</th>
                  <th className="px-4 py-2.5">{t('Хэрэглэгч')}</th>
                  <th className="px-4 py-2.5">{t('App-ууд')}</th>
                  <th className="px-4 py-2.5">{t('Үүссэн')}</th>
                  <th className="px-4 py-2.5">{t('Статус')}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {(orgs ?? []).map((o) => (
                  <tr key={o.id} className="border-b border-rule/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{o.name}</td>
                    <td className="px-4 py-2.5">{o.userCount}</td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {o.apps.map((a) => a.nameMn).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted font-mono text-xs">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      {o.isActive ? (
                        <span className="text-ok">{t('Идэвхтэй')}</span>
                      ) : (
                        <span className="text-alarm">{t('Түдгэлзсэн')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setConfirm({
                            org: o,
                            action: o.isActive ? 'suspend' : 'activate',
                          })
                        }
                        className={`text-xs border rounded px-2.5 py-1 ${
                          o.isActive
                            ? 'border-alarm/40 text-alarm hover:bg-alarm/10'
                            : 'border-rule text-ink-muted hover:text-ink'
                        }`}
                      >
                        {o.isActive ? t('Түдгэлзүүлэх') : t('Сэргээх')}
                      </button>
                    </td>
                  </tr>
                ))}
                {orgs?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                      {t('Байгууллага олдсонгүй')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── App каталог ── */}
        <section>
          <h2 className="font-serif text-xl font-medium">{t('App каталог')}</h2>
          <ul className="mt-4 space-y-2">
            {(apps ?? []).map((app) => {
              const Icon = appIcon(app.icon)
              return (
                <li
                  key={app.id}
                  className="border border-rule rounded-lg p-3 bg-surface flex items-center gap-3"
                >
                  <span
                    className="shrink-0 w-9 h-9 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: app.color }}
                  >
                    <Icon size={17} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {app.nameMn}{' '}
                      <span className="font-mono text-xs text-ink-muted">
                        {app.key}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted truncate">
                      {app.descriptionMn}
                    </p>
                  </div>
                  <select
                    value={app.status}
                    onChange={(e) => setAppStatus(app, e.target.value)}
                    className="bg-bg border border-rule rounded px-2 py-1.5 text-sm focus:outline-none"
                  >
                    {Object.entries(STATUS_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </li>
              )
            })}
          </ul>
          <NewAppForm onCreated={load} />
        </section>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.action === 'suspend'
            ? t('Байгууллага түдгэлзүүлэх үү?')
            : t('Байгууллага сэргээх үү?')
        }
        message={
          confirm?.action === 'suspend'
            ? `${confirm?.org?.name} — ${t('хэрэглэгчид нь нэвтэрч чадахгүй болно.')}`
            : `${confirm?.org?.name} — ${t('хэрэглэгчид нь дахин нэвтэрнэ.')}`
        }
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </main>
  )
}

function NewAppForm({ onCreated }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    key: '',
    nameMn: '',
    nameEn: '',
    descriptionMn: '',
    icon: 'package',
    color: '#457b9d',
  })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api('/platform/admin/apps', { method: 'POST', body: form })
      setOpen(false)
      setForm({ key: '', nameMn: '', nameEn: '', descriptionMn: '', icon: 'package', color: '#457b9d' })
      onCreated()
    } catch (err) {
      setError(err.message ?? 'Алдаа гарлаа')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink border border-dashed border-rule rounded px-3 py-2"
      >
        <Plus size={15} /> {t('Шинэ app нэмэх')}
      </button>
    )
  }

  const input =
    'w-full bg-bg border border-rule rounded px-3 py-1.5 text-sm focus:outline-none focus:border-ink-muted'
  return (
    <form
      onSubmit={submit}
      className="mt-3 border border-rule rounded-lg p-4 bg-surface space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="key (ж: sankhuu)" value={form.key} onChange={set('key')} className={input} />
        <input required placeholder={t('Нэр (МН)')} value={form.nameMn} onChange={set('nameMn')} className={input} />
        <input required placeholder="Name (EN)" value={form.nameEn} onChange={set('nameEn')} className={input} />
        <input required placeholder={t('lucide icon нэр')} value={form.icon} onChange={set('icon')} className={input} />
        <input required placeholder="#rrggbb" value={form.color} onChange={set('color')} className={input} />
      </div>
      <textarea
        required
        placeholder={t('Тайлбар (МН)')}
        value={form.descriptionMn}
        onChange={set('descriptionMn')}
        rows={2}
        className={input}
      />
      {error && <p className="text-sm text-alarm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-ink text-bg rounded px-4 py-1.5 text-sm disabled:opacity-60"
        >
          {t('Нэмэх')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border border-rule rounded px-4 py-1.5 text-sm text-ink-muted"
        >
          {t('Болих')}
        </button>
      </div>
    </form>
  )
}
