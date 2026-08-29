import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

/** Бараа нэмэх/засах форм (Modal дотор ашиглагдана) */
export default function ProductForm({
  initial,
  categories,
  companies = [],
  submitting,
  error,
  onSubmit,
  onCancel,
}) {
  const { t } = useLang()
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    sku: initial?.sku ?? '',
    categoryId: initial?.categoryId ?? '',
    companyId: initial?.companyId ?? '',
    price: initial?.price ?? '',
    costPrice: initial?.costPrice ?? '',
    lowStockLimit: initial?.lowStockLimit ?? 5,
  })

  const set = (key) => (e) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      name: values.name.trim(),
      sku: values.sku.trim(),
      price: String(values.price).trim(),
      ...(String(values.costPrice).trim()
        ? { costPrice: String(values.costPrice).trim() }
        : {}),
      lowStockLimit: Number(values.lowStockLimit),
      ...(values.categoryId ? { categoryId: values.categoryId } : {}),
      ...(values.companyId ? { companyId: values.companyId } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="p-name"
        label={t('Нэр')}
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
        label={t('Ангилал')}
        value={values.categoryId}
        onChange={set('categoryId')}
      >
        <option value="">{t('Ангилалгүй')}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      <Select
        id="p-company"
        label={t('Харилцагч компани')}
        value={values.companyId}
        onChange={set('companyId')}
      >
        <option value="">{t('Сонгоогүй')}</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input
        id="p-limit"
        label={t('Бага үлдэгдлийн лимит')}
        type="number"
        min="0"
        step="1"
        required
        value={values.lowStockLimit}
        onChange={set('lowStockLimit')}
        className="font-mono"
      />
      <Input
        id="p-price"
        label={t('Үнэ (₮)')}
        required
        inputMode="decimal"
        pattern="\d{1,10}(\.\d{1,2})?"
        title="Жишээ: 12500 эсвэл 12500.50"
        value={values.price}
        onChange={set('price')}
        placeholder="12500.00"
      />

      <Input
        id="p-cost"
        label={t('Өртөг (₮)')}
        inputMode="decimal"
        pattern="\d{1,10}(\.\d{1,2})?"
        title="Жишээ: 8500 эсвэл 8500.50"
        value={values.costPrice}
        onChange={set('costPrice')}
        placeholder={t('(заавал биш)')}
      />

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
          {initial ? t('Хадгалах') : t('Бүртгэх')}
        </Button>
      </div>
    </form>
  )
}
