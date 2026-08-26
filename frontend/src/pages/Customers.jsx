import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'

export default function Customers() {
  const { t } = useLang()
  const { hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState('registered')
  const [registered, setRegistered] = useState(null)
  const [byPhone, setByPhone] = useState(null)
  const [error, setError] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const canEdit = hasPerm('customers.edit')

  const load = useCallback(() => {
    setError(null)
    api('/customers/registered').then(setRegistered).catch((e) => setError(e))
    api('/customers/by-phone').then(setByPhone).catch((e) => setError(e))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(c) {
    setTogglingId(c.id)
    try {
      await api(`/customers/${c.id}/active`, {
        method: 'PATCH',
        body: { isActive: !c.isActive },
      })
      toast.show(t(c.isActive ? 'Идэвхгүй болголоо' : 'Идэвхжүүллээ'))
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setTogglingId(null)
    }
  }

  const goOrders = (phone) => navigate(`/orders?search=${phone}`)

  const registeredColumns = [
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
    ...(canEdit
      ? [
          {
            key: '_active',
            header: '',
            render: (c) => (
              <Button
                variant="ghost"
                loading={togglingId === c.id}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleActive(c)
                }}
                className="text-xs px-2 py-1"
              >
                {t(c.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх')}
              </Button>
            ),
          },
        ]
      : []),
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

      <div className="mt-8 flex gap-1 border-b border-rule pb-3">
        {[
          ['registered', 'Бүртгэлтэй'],
          ['phone', 'Утасны захиалгаас'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              tab === key ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t(label)}
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
        ) : tab === 'registered' ? (
          !registered ? (
            <div className="py-16 text-center">
              <Spinner size={22} />
            </div>
          ) : (
            <Table
              columns={registeredColumns}
              rows={registered}
              onRowClick={(c) => c.phone && goOrders(c.phone)}
              empty={t('Бүртгэлтэй харилцагч алга')}
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
            onRowClick={(c) => goOrders(c.phone)}
            empty={t('Захиалга алга')}
          />
        )}
      </div>
    </div>
  )
}
