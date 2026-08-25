import { useCallback, useEffect, useState } from 'react'
import ProductForm from '../components/products/ProductForm'
import StockAdjustModal from '../components/products/StockAdjustModal'
import Badge from '../components/ui/Badge'
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
import { api } from '../lib/api'
import { formatMoney } from '../lib/format'

const LIMIT = 20
const LOW_STOCK = 10

/** Үлдэгдлийн нүд: 0 — улаан badge, бага — шар, бусад — энгийн mono */
function StockCell({ qty }) {
  if (qty === 0) {
    return (
      <span className="inline-flex font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12">
        Дууссан
      </span>
    )
  }
  if (qty < LOW_STOCK) {
    return (
      <span className="font-mono tabular-nums text-status-preparing">{qty}</span>
    )
  }
  return <span className="font-mono tabular-nums">{qty}</span>
}

export default function Products() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const toast = useToast()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState([])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [adjusting, setAdjusting] = useState(null)
  const [deactivating, setDeactivating] = useState(null)
  const [busy, setBusy] = useState(false)

  // Хайлтын debounce 300ms — бичиж дуусахаар л хүсэлт явна
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(() => {
    setError(null)
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (search) q.set('search', search)
    if (categoryId) q.set('categoryId', categoryId)
    api(`/products?${q}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [search, categoryId, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api('/categories')
      .then(setCategories)
      .catch(() => {})
  }, [])

  async function handleFormSubmit(values) {
    setBusy(true)
    try {
      if (editing) {
        await api(`/products/${editing.id}`, { method: 'PATCH', body: values })
        toast.show('Бараа шинэчлэгдлээ')
      } else {
        await api('/products', { method: 'POST', body: values })
        toast.show('Шинэ бараа бүртгэгдлээ')
      }
      setFormOpen(false)
      setEditing(null)
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate() {
    setBusy(true)
    try {
      await api(`/products/${deactivating.id}`, { method: 'DELETE' })
      toast.show(`«${deactivating.name}» идэвхгүй боллоо`)
      setDeactivating(null)
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'sku',
      header: 'SKU',
      render: (p) => <span className="font-mono text-ink-muted">{p.sku}</span>,
    },
    { key: 'name', header: 'Нэр' },
    {
      key: 'category',
      header: 'Ангилал',
      render: (p) => (
        <span className="text-ink-muted">{p.category?.name ?? '—'}</span>
      ),
    },
    {
      key: 'price',
      header: 'Үнэ',
      align: 'right',
      render: (p) => (
        <span className="font-mono tabular-nums">{formatMoney(p.price)}</span>
      ),
    },
    {
      key: 'stockQty',
      header: 'Үлдэгдэл',
      align: 'right',
      render: (p) => <StockCell qty={p.stockQty} />,
    },
    {
      key: 'isActive',
      header: 'Төлөв',
      render: (p) =>
        p.isActive ? (
          <Badge className="text-safe border-safe/40 bg-safe/12">Идэвхтэй</Badge>
        ) : (
          <Badge>Идэвхгүй</Badge>
        ),
    },
    ...(isAdmin
      ? [
          {
            key: '_actions',
            header: '',
            align: 'right',
            render: (p) => (
              <span
                className="inline-flex gap-3 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="text-ink-muted hover:text-ink"
                  onClick={() => {
                    setEditing(p)
                    setFormOpen(true)
                  }}
                >
                  Засах
                </button>
                <button
                  type="button"
                  className="text-ink-muted hover:text-ink"
                  onClick={() => setAdjusting(p)}
                >
                  Үлдэгдэл
                </button>
                <button
                  type="button"
                  className="text-ink-muted hover:text-alarm"
                  onClick={() => setDeactivating(p)}
                >
                  Идэвхгүй
                </button>
              </span>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">Бараа</h1>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            + Шинэ бараа
          </Button>
        )}
      </div>

      <div className="mt-8 flex items-end gap-3 flex-wrap">
        <Input
          id="product-search"
          label="Хайлт"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Нэр эсвэл SKU…"
          className="w-64"
        />
        <Select
          id="product-category"
          label="Ангилал"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setPage(1)
          }}
          className="w-44"
        >
          <option value="">Бүх ангилал</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-8">
        {error ? (
          <EmptyState
            title="Жагсаалт ачаалж чадсангүй"
            note={error.message}
            action={<Button onClick={load}>Дахин оролдох</Button>}
          />
        ) : !data ? (
          <div className="py-16 text-center">
            <Spinner size={22} />
          </div>
        ) : (
          <Table
            columns={columns}
            rows={data.items}
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
            empty="Бараа олдсонгүй"
          />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        title={editing ? `Засах — ${editing.name}` : 'Шинэ бараа'}
      >
        <ProductForm
          key={editing?.id ?? 'new'}
          initial={editing}
          categories={categories}
          submitting={busy}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      </Modal>

      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null)
            load()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deactivating}
        title="Идэвхгүй болгох"
        message={`«${deactivating?.name}» барааг идэвхгүй болгох уу? Жагсаалтад харагдахгүй болно, хуучин захиалгууд хадгалагдана.`}
        confirmLabel="Идэвхгүй болгох"
        danger
        loading={busy}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  )
}
