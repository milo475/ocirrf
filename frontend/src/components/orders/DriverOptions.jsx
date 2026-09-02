import { useLang } from '../../context/LanguageContext'

/**
 * Жолоочийн сонголтыг ХАРЬЯАЛАХ БҮСЭЭР нь эрэмбэлнэ (V5).
 *
 * Өмнө нь бүс нь зөвхөн шошго байсан — хуваарилах цонх идэвхтэй БҮХ
 * жолоочийг ялгалгүй жагсаадаг тул ажилтан аль дүүрэгт хэн явдгийг
 * толгойноосоо санах шаардлагатай байв. Одоо тухайн дүүрэг(үүд)-ийг
 * хамардаг жолооч дээр гарч ирнэ; бусад нь доор, тусдаа бүлэгт.
 */
export function splitByZone(drivers, districts) {
  const wanted = [...new Set(districts.filter(Boolean))]
  if (wanted.length === 0) return { matched: [], others: drivers, wanted }

  const cover = (d) => wanted.filter((x) => (d.zones ?? []).includes(x))
  const matched = []
  const others = []
  for (const d of drivers) {
    const c = cover(d)
    if (c.length > 0) matched.push({ ...d, covers: c })
    else others.push(d)
  }
  // Хамрах хүрээ ихтэй нь, дараа нь ачаалал багатай нь дээр
  matched.sort(
    (a, b) => b.covers.length - a.covers.length || a.active - b.active,
  )
  return { matched, others, wanted }
}

/** <Select> дотор тавих <optgroup>-ууд */
export default function DriverOptions({ drivers, districts }) {
  const { t } = useLang()
  const { matched, others, wanted } = splitByZone(drivers ?? [], districts)

  const line = (d) =>
    `${d.name} — ${d.active} ${t('идэвхтэй хүргэлт')}${
      d.isAvailable === false ? ` ${t('(завгүй)')}` : ''
    }`

  if (wanted.length === 0) {
    return (drivers ?? []).map((d) => (
      <option key={d.id} value={d.id}>
        {line(d)}
      </option>
    ))
  }

  return (
    <>
      {matched.length > 0 && (
        <optgroup label={`${wanted.join(', ')} — ${t('бүсэд нь харьяалагдах')}`}>
          {matched.map((d) => (
            <option key={d.id} value={d.id}>
              {line(d)} · {d.covers.join(', ')}
            </option>
          ))}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label={t('Бусад жолооч — бүс нь таарахгүй')}>
          {others.map((d) => (
            <option key={d.id} value={d.id}>
              {line(d)}
              {d.zones?.length ? ` · ${d.zones.join(', ')}` : ` · ${t('бүсгүй')}`}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )
}
