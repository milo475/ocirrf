import { useCallback, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'

/**
 * Нийлүүлэлт (V5).
 *
 * Харилцагч (өөр компаниас бараа нийлүүлдэг түнш) хэзээ юуг ямар
 * өртгөөр авчирсан, бид хэдийг төлсөн, ХЭД ӨРТЭЙГ энд хөтөлнө. Өмнө нь
 * энэ бүхэн Excel дээр байсан тул систем нь хэн юу нийлүүлснийг
 * мэддэггүй байв.
 *
 * Харилцагч өөрөө нэвтэрвэл ЗӨВХӨН өөрийн компанийн мөрүүдийг харна
 * (backend талд шүүгддэг).
 */
export default function Supplies() {
  const { t } = useLang()
  const { user, hasPerm } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('list')
  const [rows, setRows] = useState(null)
  const [balances, setBalances] = useState(null)
  const [error, setError] = useState(null)
  const [newOpen, setNewOpen] = useState(false)
  const [paying, setPaying] = useState(null)
  /** Дотоод ажилтан бүх компанийг хардаг тул шүүлтүүр хэрэгтэй */
  const isInternal = !user?.companyId
  const [filterCo, setFilterCo] = useState('')

  const load = useCallback(() => {
    setError(null)
    Promise.all([
      api(`/supplies${filterCo ? `?companyId=${filterCo}` : ''}`),
      api('/supplies/balances'),
    ])
      .then(([s, b]) => {
        setRows(s)
        setBalances(b)
      })
      .catch((e) => setError(e))
  }, [filterCo])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div>
        <h1 className="font-serif text-4xl font-medium">{t('Нийлүүлэлт')}</h1>
        <p className="mt-8 text-sm text-alarm border border-alarm rounded px-3 py-2">
          {error.message}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl font-medium">{t('Нийлүүлэлт')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t('Харилцагчаас хүлээж авсан бараа ба тооцоо')}
          </p>
        </div>
        {hasPerm('supplies.create') && (
          <Button onClick={() => setNewOpen(true)}>
            {t('+ Бараа хүлээж авах')}
          </Button>
        )}
      </div>

      <div className="mt-8 flex gap-1 items-center border-b border-rule pb-3 flex-wrap">
        {[
          ['list', 'Нийлүүлэлтүүд'],
          ['balances', 'Харилцагчийн тооцоо'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              tab === key ? 'bg-ink text-bg' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t(label)}
          </button>
        ))}
        {isInternal && tab === 'list' && balances && balances.length > 1 && (
          <select
            aria-label={t('Харилцагчаар шүүх')}
            value={filterCo}
            onChange={(e) => setFilterCo(e.target.value)}
            className="ml-auto bg-bg border border-rule rounded px-2 py-1.5 text-sm focus:outline-none focus:border-ink-muted"
          >
            <option value="">
              {t('Харилцагч')}: {t('Бүгд')}
            </option>
            {balances.map((b) => (
              <option key={b.companyId} value={b.companyId}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {rows === null ? (
        <div className="mt-16 flex justify-center">
          <Spinner />
        </div>
      ) : tab === 'balances' ? (
        <BalanceTable rows={balances} t={t} />
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t('Нийлүүлэлт алга')}
            note={t('Харилцагчаас бараа хүлээж авахад энд бүртгэгдэнэ')}
          />
        </div>
      ) : (
        <ul className="mt-6 border border-rule rounded-lg divide-y divide-rule">
          {rows.map((s) => {
            const due = Number(s.dueAmount)
            return (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm">{s.number}</span>
                      <span className="font-medium">{s.company.name}</span>
                      {s.supplier && (
                        <span className="text-sm text-ink-muted">
                          {s.supplier.fullName}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {s.items
                        .map((i) => `${i.productName} ×${i.qty}`)
                        .join(', ')}
                    </p>
                    <p className="text-xs text-ink-muted font-mono">
                      {formatDateTime(s.createdAt)} · {s.receivedBy.fullName}
                      {s.note ? ` · ✎ ${s.note}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono tabular-nums">
                      {formatMoney(s.totalCost)}
                    </p>
                    <p
                      className={`font-mono text-xs tabular-nums ${
                        due > 0 ? 'text-alarm' : 'text-safe'
                      }`}
                    >
                      {due > 0
                        ? `${t('Өр')} ${formatMoney(due)}`
                        : `✓ ${t('Төлсөн')}`}
                    </p>
                    {due > 0 && hasPerm('supplies.pay') && (
                      <Button
                        variant="ghost"
                        className="mt-2"
                        onClick={() => setPaying(s)}
                      >
                        {t('Төлбөр хийх')}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {newOpen && (
        <NewSupplyModal
          t={t}
          toast={toast}
          onClose={() => setNewOpen(false)}
          onDone={() => {
            setNewOpen(false)
            load()
          }}
        />
      )}

      {paying && (
        <PayModal
          supply={paying}
          t={t}
          toast={toast}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            load()
          }}
        />
      )}
    </div>
  )
}

/** Харилцагч тус бүрийн тооцоо — «хэдийг төлөх ёстой вэ» */
function BalanceTable({ rows, t }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState title={t('Харилцагч алга')} />
      </div>
    )
  }
  const totalDue = rows.reduce((a, r) => a + Number(r.dueAmount), 0)
  return (
    <div className="mt-6">
      <div className="border border-rule rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-xs uppercase tracking-wide text-ink-muted">
              <th className="text-left px-4 py-2">{t('Харилцагч')}</th>
              <th className="text-right px-4 py-2">{t('Нийлүүлэлт')}</th>
              <th className="text-right px-4 py-2">{t('Нийт өртөг')}</th>
              <th className="text-right px-4 py-2">{t('Төлсөн')}</th>
              <th className="text-right px-4 py-2">{t('Өр')}</th>
              <th className="text-right px-4 py-2">{t('Сүүлд')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.map((r) => (
              <tr key={r.companyId}>
                <td className="px-4 py-2">
                  {r.name}
                  {r.phone && (
                    <span className="ml-2 font-mono text-xs text-ink-muted">
                      {r.phone}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {r.supplies}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {formatMoney(r.totalCost)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-safe">
                  {formatMoney(r.paidAmount)}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono tabular-nums ${
                    Number(r.dueAmount) > 0 ? 'text-alarm' : 'text-ink-muted'
                  }`}
                >
                  {formatMoney(r.dueAmount)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-ink-muted">
                  {r.lastSupplyAt ? formatDateTime(r.lastSupplyAt) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-right text-sm">
        {t('Нийт өр')}
        <span
          className={`ml-2 font-mono text-lg tabular-nums ${
            totalDue > 0 ? 'text-alarm' : 'text-safe'
          }`}
        >
          {formatMoney(totalDue)}
        </span>
      </p>
    </div>
  )
}

/** Бараа хүлээж авах — үлдэгдэл ЭНД нэмэгдэнэ */
function NewSupplyModal({ t, toast, onClose, onDone }) {
  const [companies, setCompanies] = useState(null)
  const [products, setProducts] = useState(null)
  const [companyId, setCompanyId] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([]) // {productId, name, qty, unitCost}
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  /** Урсгал доторх хурдан үүсгэлт — компанигүйн улмаас гацахгүйн тулд */
  const [newCo, setNewCo] = useState(null) // {name, phone} | null
  const [coBusy, setCoBusy] = useState(false)
  const [coError, setCoError] = useState(null)

  async function createCompany(e) {
    e.preventDefault()
    const name = newCo.name.trim()
    if (name.length < 2) return
    setCoBusy(true)
    setCoError(null)
    try {
      const co = await api('/companies/quick', {
        method: 'POST',
        body: { name, phone: newCo.phone.trim() || undefined },
      })
      setCompanies((list) => [...(list ?? []), co])
      setCompanyId(co.id)
      setNewCo(null)
      toast.show(t('{name} нэмэгдлээ', { name: co.name }))
    } catch (err) {
      // Нэр давхардвал сервер байгаа компанийг санал болгодог
      const dup = err.existing
      if (dup) {
        setCompanies((list) =>
          (list ?? []).some((c) => c.id === dup.id) ? list : [...(list ?? []), dup],
        )
        setCompanyId(dup.id)
        setNewCo(null)
        toast.show(t('{name} аль хэдийн бүртгэлтэй — сонголоо', { name: dup.name }))
      } else {
        setCoError(err.message)
      }
    } finally {
      setCoBusy(false)
    }
  }

  useEffect(() => {
    Promise.all([api('/companies'), api('/products?limit=200')])
      .then(([c, p]) => {
        setCompanies(c.filter((x) => x.isActive))
        setProducts(p.items)
      })
      .catch((e) => setError(e.message))
  }, [])

  function add() {
    const p = products.find((x) => x.id === pick)
    if (!p || items.some((i) => i.productId === p.id)) return
    setItems((l) => [
      ...l,
      {
        productId: p.id,
        name: p.name,
        qty: 1,
        unitCost: String(Math.round(Number(p.costPrice ?? 0))),
        expiryDate: '',
        batchNo: '',
      },
    ])
    setPick('')
  }
  const upd = (id, k, v) =>
    setItems((l) => l.map((i) => (i.productId === id ? { ...i, [k]: v } : i)))

  const total = items.reduce(
    (a, i) => a + (Number(i.unitCost) || 0) * (Number(i.qty) || 0),
    0,
  )

  async function submit(e) {
    e.preventDefault()
    if (!companyId || items.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await api('/supplies', {
        method: 'POST',
        body: {
          companyId,
          note: note.trim() || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            qty: Number(i.qty),
            unitCost: String(i.unitCost),
            // Хугацаа өгсөн мөрөнд л цуврал үүснэ — хугацаагүй
            // бараанд (сав, баглаа) шаардлагагүй
            ...(i.expiryDate ? { expiryDate: i.expiryDate } : {}),
            ...(i.expiryDate && i.batchNo.trim()
              ? { batchNo: i.batchNo.trim() }
              : {}),
          })),
        },
      })
      toast.show(t('{no} бүртгэгдлээ', { no: res.number }))
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('Бараа хүлээж авах')}>
      <form onSubmit={submit} className="space-y-4">
        {companies === null ? (
          <p className="text-sm text-ink-muted">…</p>
        ) : newCo ? (
          <div className="border border-rule rounded p-3 space-y-3">
            <p className="text-xs uppercase tracking-wide text-ink-muted">
              {t('Шинэ нийлүүлэгч компани')}
            </p>
            <Input
              id="co-name"
              label={t('Нэр')}
              autoFocus
              value={newCo.name}
              onChange={(e) => setNewCo({ ...newCo, name: e.target.value })}
            />
            <Input
              id="co-phone"
              label={t('Утас')}
              value={newCo.phone}
              onChange={(e) => setNewCo({ ...newCo, phone: e.target.value })}
            />
            {coError && (
              <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
                {coError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setNewCo(null)
                  setCoError(null)
                }}
                disabled={coBusy}
              >
                {t('Болих')}
              </Button>
              <Button
                loading={coBusy}
                disabled={newCo.name.trim().length < 2}
                onClick={createCompany}
              >
                {t('Үүсгэх')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Select
              id="sup-company"
              label={t('Харилцагч компани')}
              value={companyId}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setNewCo({ name: '', phone: '' })
                  return
                }
                setCompanyId(e.target.value)
              }}
            >
              <option value="">—</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ {t('Шинэ компани үүсгэх')}</option>
            </Select>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <Select
            id="sup-pick"
            label={t('Бараа')}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="flex-1"
          >
            <option value="">—</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Button variant="ghost" onClick={add} disabled={!pick}>
            {t('Нэмэх')}
          </Button>
        </div>

        {items.length > 0 && (
          <ul className="border border-rule rounded divide-y divide-rule">
            {items.map((i) => (
              <li key={i.productId} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate text-sm">{i.name}</span>
                  <input
                    aria-label={t('Тоо')}
                    value={i.qty}
                    onChange={(e) => upd(i.productId, 'qty', e.target.value)}
                    inputMode="numeric"
                    className="w-16 bg-bg border border-rule rounded px-2 py-1 text-sm text-right"
                  />
                  <input
                    aria-label={t('Өртөг')}
                    value={i.unitCost}
                    onChange={(e) => upd(i.productId, 'unitCost', e.target.value)}
                    inputMode="numeric"
                    className="w-24 bg-bg border border-rule rounded px-2 py-1 text-sm text-right"
                  />
                  <button
                    type="button"
                    aria-label={t('Хасах')}
                    onClick={() =>
                      setItems((l) => l.filter((x) => x.productId !== i.productId))
                    }
                    className="text-ink-muted hover:text-alarm px-1"
                  >
                    ×
                  </button>
                </div>
                {/* Хугацаа — заавал биш. Оруулбал цуврал үүсч,
                    бараа FEFO дарааллаар гарна. */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-ink-muted shrink-0">
                    {t('expiry.label')}
                  </span>
                  <input
                    aria-label={`${i.name} — ${t('дуусах хугацаа')}`}
                    type="date"
                    value={i.expiryDate}
                    onChange={(e) => upd(i.productId, 'expiryDate', e.target.value)}
                    className="bg-bg border border-rule rounded px-2 py-1 text-xs"
                  />
                  <input
                    aria-label={`${i.name} — ${t('цувралын дугаар')}`}
                    placeholder={t('Цувралын дугаар')}
                    value={i.batchNo}
                    onChange={(e) => upd(i.productId, 'batchNo', e.target.value)}
                    className="flex-1 min-w-24 bg-bg border border-rule rounded px-2 py-1 text-xs"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-right text-sm">
          {t('Нийт өртөг')}
          <span className="ml-2 font-mono text-lg tabular-nums">
            {formatMoney(total)}
          </span>
        </p>

        <Input
          id="sup-note"
          label={t('Тэмдэглэл')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('Болих')}
          </Button>
          <Button
            type="submit"
            loading={busy}
            disabled={!companyId || items.length === 0}
          >
            {t('Хүлээж авах')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Харилцагчид төлбөр хийх — санхүүд зарлага болно */
function PayModal({ supply, t, toast, onClose, onDone }) {
  const due = Number(supply.dueAmount)
  const [amount, setAmount] = useState(String(Math.round(due)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`/supplies/${supply.id}/pay`, {
        method: 'POST',
        body: { amount: String(amount) },
      })
      toast.show(t('Төлбөр бүртгэгдлээ'))
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${t('Төлбөр хийх')} — ${supply.number}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          {supply.company.name} · {t('Үлдсэн өр')}{' '}
          <span className="font-mono text-alarm">{formatMoney(due)}</span>
        </p>
        <Input
          id="pay-amount"
          label={t('Дүн')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
        />
        {error && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('Болих')}
          </Button>
          <Button type="submit" loading={busy}>
            {t('Төлөх')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
