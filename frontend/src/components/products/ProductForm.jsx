import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

/** Бараа нэмэх/засах форм (Modal дотор ашиглагдана) */
export default function ProductForm({
  initial,
  categories,
  submitting,
  onSubmit,
  onCancel,
}) {
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    sku: initial?.sku ?? '',
    categoryId: initial?.categoryId ?? '',
    price: initial?.price ?? '',
  })

  const set = (key) => (e) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      name: values.name.trim(),
      sku: values.sku.trim(),
      price: String(values.price).trim(),
      ...(values.categoryId ? { categoryId: values.categoryId } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="p-name"
        label="Нэр"
        required
        minLength={2}
        value={values.name}
        onChange={set('name')}
        placeholder="Цагаан будаа 5кг"
      />
      <Input
        id="p-sku"
        label="SKU"
        required
        value={values.sku}
        onChange={set('sku')}
        placeholder="UG-0009"
        className="font-mono"
      />
      <Select
        id="p-category"
        label="Ангилал"
        value={values.categoryId}
        onChange={set('categoryId')}
      >
        <option value="">Ангилалгүй</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input
        id="p-price"
        label="Үнэ (₮)"
        required
        inputMode="decimal"
        pattern="\d{1,10}(\.\d{1,2})?"
        title="Жишээ: 12500 эсвэл 12500.50"
        value={values.price}
        onChange={set('price')}
        placeholder="12500.00"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Болих
        </Button>
        <Button type="submit" loading={submitting}>
          {initial ? 'Хадгалах' : 'Бүртгэх'}
        </Button>
      </div>
    </form>
  )
}
