import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import CustomerHistoryModal from '../components/customers/CustomerHistoryModal'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'

export default function Customers() {
  const { t } = useLang()
  const navigate = useNavigate()

  // Харилцагч = бараа нийлүүлдэг түнш (системд OPERATOR эрхтэй) — default таб
  const [tab, setTab] = useState('companies')
  const [companies, setCompanies] = useState(null)
  const [partners, setPartners] = useState(null)
  const [byPhone, setByPhone] = useState(null)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState(null)


  const load = useCallback(() => {
    setError(null)
    api('/companies').then(setCompanies).catch((e) => setError(e))
    api('/customers/partners').then(setPartners).catch((e) => setError(e))
    api('/customers/by-phone').then(setByPhone).catch((e) => setError(e))
  }, [])

  useEffect(() => {
    load()
  }, [load])


  const goOrders = (phone) => navigate(`/orders?search=${phone}`)

  /** Харилцагч компани — оператор ба барааны тоотой */
  const companyColumns = [
    { key: 'name', header: t('Компани') },
    {
      key: 'phone',
      header: t('Утас'),
      render: (c) => (
        <span className="font-mono tabular-nums">{c.phone ?? '—'}</span>
      ),
    },
    {
      key: 'operators',
      header: t('Оператор'),
      align: 'right',
      render: (c) => (
        <span className="font-mono tabular-nums">{c.operators}</span>
      ),
    },
    {
      key: 'products',
      header: t('Бараа'),
      align: 'right',
      render: (c) => (
        <span className="font-mono tabular-nums">{c.products}</span>
      ),
    },
    {
      key: 'active',
      header: t('Идэвхтэй'),
      render: (c) => (
        <span
          className={`inline-flex font-mono text-[10px] uppercase tracking-wide border rounded px-1 py-0.5 ${
            c.isActive
              ? 'text-safe border-safe/40 bg-safe/12'
              : 'text-alarm border-alarm/40 bg-alarm/10'
          }`}
        >
          {t(c.isActive ? 'Идэвхтэй' : 'Идэвхгүй')}
        </span>
      ),
    },
  ]

  /** Харилцагч (түнш) — нэр, холбоо, захиалгын статистик */
  const partnerColumns = [
    { key: 'name', header: t('Нэр') },
    {
      key: 'email',
      header: t('Имэйл'),
      render: (c) => <span className="font-mono text-sm">{c.email}</span>,
    },
    {
      key: 'phone',
      header: t('Утас'),
      render: (c) => (
        <span className="font-mono tabular-nums">{c.phone ?? '—'}</span>
      ),
    },
    {
      key: 'orders',
      header: t('Захиалга'),
      align: 'right',
      render: (c) => <span className="font-mono tabular-nums">{c.orders}</span>,
    },
    {
      key: 'total',
      header: t('Нийт дүн'),
      align: 'right',
      render: (c) => (
        <span className="font-mono tabular-nums">
          {formatMoney(c.totalAmount)}
        </span>
      ),
    },
    {
      key: 'last',
      header: t('Сүүлийн захиалга'),
      render: (c) =>
        c.lastOrderAt ? (
          <span className="font-mono text-xs text-ink-muted tabular-nums">
            {formatDateTime(c.lastOrderAt)}
          </span>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: 'active',
      header: t('Идэвхтэй'),
      render: (c) => (
        <span
          className={`inline-flex font-mono text-[10px] uppercase tracking-wide border rounded px-1 py-0.5 ${
            c.isActive
              ? 'text-safe border-safe/40 bg-safe/12'
              : 'text-alarm border-alarm/40 bg-alarm/10'
          }`}
        >
          {t(c.isActive ? 'Идэвхтэй' : 'Идэвхгүй')}
        </span>
      ),
    },
  ]


  const phoneColumns = [
    {
      key: 'phone',
      header: t('Утас'),
      render: (c) => <span className="font-mono tabular-nums">{c.phone}</span>,
    },
    {
      key: 'names',
      header: t('Нэр(үүд)'),
      render: (c) => (
        <span className="text-sm">{c.names.join(', ') || '—'}</span>
      ),
    },
    {
      key: 'orders',
      header: t('Захиалга'),
      align: 'right',
      render: (c) => <span className="font-mono tabular-nums">{c.orders}</span>,
    },
    {
      key: 'total',
      header: t('Нийт дүн'),
      align: 'right',
      render: (c) => (
        <span className="font-mono tabular-nums">
          {formatMoney(c.totalAmount)}
        </span>
      ),
    },
    {
      key: 'last',
      header: t('Сүүлийн захиалга'),
      render: (c) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {formatDateTime(c.lastOrderAt)}
        </span>
      ),
    },
  ]

  return (
    <div>
      <h1 className="font-serif text-4xl font-medium">{t('Харилцагчид')}</h1>

      <div className="mt-8 flex gap-1 border-b border-rule pb-3 flex-wrap">
        {[
          ['companies', 'Компаниуд', companies],
          ['partners', 'Харилцагчид', partners],
          ['phone', 'Захиалгын хүлээн авагчид', byPhone],
        ].map(([key, label, list]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              tab === key ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t(label)}
            {list && (
              <span className="ml-1.5 font-mono text-xs text-ink-muted">
                ({list.length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error ? (
          <EmptyState
            title={t('Жагсаалт ачаалж чадсангүй')}
            note={error.message}
            action={<Button onClick={load}>{t('Дахин оролдох')}</Button>}
          />
        ) : tab === 'companies' ? (
          !companies ? (
            <div className="py-16 text-center">
              <Spinner size={22} />
            </div>
          ) : (
            <Table
              columns={companyColumns}
              rows={companies}
              empty={t('Компани алга')}
            />
          )
        ) : tab === 'partners' ? (
          !partners ? (
            <div className="py-16 text-center">
              <Spinner size={22} />
            </div>
          ) : (
            <Table
              columns={partnerColumns}
              rows={partners}
              empty={t('Харилцагч алга — Хэрэглэгчид хуудаснаас «Харилцагч» эрхтэйгээр бүртгэнэ')}
            />
          )
        ) : !byPhone ? (
          <div className="py-16 text-center">
            <Spinner size={22} />
          </div>
        ) : (
          <Table
            columns={phoneColumns}
            rows={byPhone}
            onRowClick={(c) =>
              setHistory({ phone: c.phone, name: c.names?.[0] })
            }
            empty={t('Захиалга алга')}
          />
        )}
      </div>
      {history && (
        <CustomerHistoryModal
          phone={history.phone}
          name={history.name}
          onClose={() => setHistory(null)}
        />
      )}
    </div>
  )
}
