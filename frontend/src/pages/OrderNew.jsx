import { useState } from 'react'
import { useNavigate } from 'react-router'
import ProductPicker from '../components/orders/ProductPicker'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { api } from '../lib/api'
import { formatMoney } from '../lib/format'

export default function OrderNew() {
  const navigate = useNavigate()
  const toast = useToast()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([]) // [{ product, qty }]
  const [submitting, setSubmitting] = useState(false)

  function addProduct(product) {
    // Нэг бараа давхар нэмэгдэхгүй (picker дээр ч disabled байдаг)
    setItems((list) =>
      list.some((i) => i.product.id === product.id)
        ? list
        : [...list, { product, qty: 1 }],
    )
  }

  function setQty(productId, qty) {
    setItems((list) =>
      list.map((i) =>
        i.product.id === productId ? { ...i, qty } : i,
      ),
    )
  }

  function removeItem(productId) {
    setItems((list) => list.filter((i) => i.product.id !== productId))
  }

  // Live нийт дүн (зөвхөн харуулах зорилготой — жинхэнэ дүнг backend Decimal-аар тооцно)
  const total = items.reduce(
    (a, i) => a + Number(i.product.price) * (Number(i.qty) || 0),
    0,
  )

  const canSubmit =
    customerName.trim().length >= 2 &&
    customerPhone.trim().length > 0 &&
    items.length > 0 &&
    items.every((i) => Number.isInteger(Number(i.qty)) && Number(i.qty) >= 1)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
          items: items.map((i) => ({
            productId: i.product.id,
            qty: Number(i.qty),
          })),
        },
      })
      toast.show(`Захиалга ${order.orderNo} үүслээ`)
      navigate(`/orders/${order.id}`)
    } catch (err) {
      // Жишээ нь: «Сүү 1л» үлдэгдэл хүрэлцэхгүй (байгаа: X, хүссэн: Y)
      toast.show(err.message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      <h1 className="font-serif text-4xl font-medium">Шинэ захиалга</h1>

      {/* 1 — Харилцагч */}
      <section className="mt-10">
        <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
          Харилцагч
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <Input
            id="o-name"
            label="Нэр"
            required
            minLength={2}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Бат-Эрдэнэ"
          />
          <Input
            id="o-phone"
            label="Утас"
            required
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="99112233"
            className="font-mono"
          />
        </div>
        <Input
          id="o-note"
          label="Тэмдэглэл"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Хүргэлтийн заавар г.м. (заавал биш)"
          className="mt-4"
        />
      </section>

      {/* 2 — Барааны мөрүүд */}
      <section className="mt-12 border-t border-rule pt-8">
        <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
          Бараа
        </p>
        <ProductPicker
          onPick={addProduct}
          excludeIds={items.map((i) => i.product.id)}
        />

        {items.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Бараа сонгогдоогүй"
              note="Дээрх хайлтаар бараа нэмнэ үү"
            />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-rule border-y border-rule">
            {items.map(({ product, qty }) => {
              const over = Number(qty) > product.stockQty
              const line = Number(product.price) * (Number(qty) || 0)
              return (
                <div key={product.id} className="py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{product.name}</p>
                      <p className="font-mono text-xs text-ink-muted tabular-nums">
                        {product.sku} · {formatMoney(product.price)}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={qty}
                      onChange={(e) => setQty(product.id, e.target.value)}
                      aria-label={`${product.name} тоо ширхэг`}
                      className="w-20 bg-bg border border-rule rounded px-2 py-1.5 text-sm font-mono text-right focus:outline-none focus:border-ink-muted"
                    />
                    <span className="font-mono text-sm tabular-nums w-28 text-right">
                      {formatMoney(line)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(product.id)}
                      aria-label="Мөр устгах"
                      className="text-ink-muted hover:text-alarm text-lg leading-none px-1"
                    >
                      ×
                    </button>
                  </div>
                  {over && (
                    // UX зөвлөмж — илгээхийг хориглохгүй, жинхэнэ шалгалт backend-д
                    <p className="mt-1.5 text-xs text-status-preparing">
                      ⚠ Үлдэгдэл: {product.stockQty}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 4 — Нийт дүн + 5 — илгээх */}
      <section className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          Нийт{' '}
          <span className="font-mono text-2xl text-ink tabular-nums ml-2">
            {formatMoney(total)}
          </span>
        </p>
        <Button type="submit" loading={submitting} disabled={!canSubmit}>
          Захиалга үүсгэх
        </Button>
      </section>
    </form>
  )
}
