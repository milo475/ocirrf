/**
 * Бүтэцлэгдсэн хаягийг нэг мөр болгоно —
 * backend-ийн address.util.ts-тэй ижил формат (тоймд ашиглана).
 */
export function formatFullAddress(a) {
  if (a.region === 'ULAANBAATAR') {
    return [
      a.district,
      a.khoroo ? `${a.khoroo}-р хороо` : null,
      a.building,
      a.entrance ? `${a.entrance}-р орц` : null,
      a.floor ? `${a.floor} давхар` : null,
      a.door ? `${a.door} тоот` : null,
    ]
      .filter(Boolean)
      .join(', ')
  }
  const base = [a.province, a.soum ? `${a.soum} сум` : null]
    .filter(Boolean)
    .join(', ')
  const withTransport = a.transport ? `${base} — Тээвэр: ${a.transport}` : base
  return a.addressDetail ? `${withTransport}, ${a.addressDetail}` : withTransport
}
