/**
 * Агуулахын бэлтгэх хуудас (V4-11) — хэвлэх цонх.
 * a) Нэгтгэсэн хэсэг: бүх сонгосон захиалгын бараа нэгтгэсэн нийлбэр
 *    тоогоор (агуулахаас нэг дор түүхэд) — checkbox баганатай
 * b) Захиалга тус бүрийн хэсэг: orderNo, хаяг, утас, бараа ×тоо,
 *    тэмдэглэл — баглахад
 */

import { formatDateTime } from './format'

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )

/**
 * orders — GET /orders/:id-ийн бүтэн хариунууд (items + fullAddress).
 * skuById — productId → SKU (байхгүй бол хоосон, best effort).
 */
export function openPickingSheet(orders, t, skuById = {}) {
  // a) Нэгтгэл: productId-аар нийлбэр
  const agg = new Map()
  for (const o of orders) {
    for (const i of o.items) {
      const cur = agg.get(i.productId) ?? { name: i.productName, qty: 0 }
      cur.qty += i.qty
      agg.set(i.productId, cur)
    }
  }
  const aggRows = [...agg.entries()]
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(
      ([pid, a]) => `<tr>
        <td class="chk">☐</td>
        <td class="mono">${esc(skuById[pid] ?? '')}</td>
        <td>${esc(a.name)}</td>
        <td class="num"><b>${a.qty}</b></td>
      </tr>`,
    )
    .join('')

  // b) Захиалга тус бүр
  const orderBlocks = orders
    .map(
      (o) => `<div class="order">
      <div class="ohead">
        <b class="mono">${esc(o.orderNo)}</b>
        <span class="mono muted">${esc(o.phone)}</span>
      </div>
      <p class="muted addr">${esc(o.fullAddress ?? '')}${
        o.customerName ? ` — ${esc(o.customerName)}` : ''
      }</p>
      <table>
        ${o.items
          .map(
            (i) => `<tr>
          <td class="chk">☐</td>
          <td>${esc(i.productName)}</td>
          <td class="num">× ${i.qty}</td>
        </tr>`,
          )
          .join('')}
      </table>
      ${o.note ? `<p class="note">✎ ${esc(o.note)}</p>` : ''}
    </div>`,
    )
    .join('')

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(t('Бэлтгэх хуудас'))}</title>
<style>
  body { font-family: 'Noto Sans', sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;
       color: #666; margin: 28px 0 4px; }
  .muted { color: #666; font-size: 13px; }
  .mono { font-family: ui-monospace, monospace; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #111; padding-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .chk { width: 24px; font-size: 16px; color: #999; }
  .order { border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px;
           margin-top: 12px; break-inside: avoid; }
  .ohead { display: flex; justify-content: space-between; font-size: 15px; }
  .addr { margin: 4px 0 0; }
  .note { font-size: 13px; background: #f6f6f6; border-radius: 4px;
          padding: 6px 8px; margin: 8px 0 0; }
  @media print { body { margin: 10mm; } .noprint { display: none; } }
  .noprint { margin-top: 32px; }
  .noprint button { padding: 8px 20px; font-size: 14px; }
</style></head><body>
  <div class="head">
    <div>
      <h1>${esc(t('Бэлтгэх хуудас'))}</h1>
      <p class="muted">${esc(t('{n} захиалга', { n: orders.length }))}</p>
    </div>
    <p class="muted mono">${esc(formatDateTime(new Date()))}</p>
  </div>

  <h2>${esc(t('Нэгтгэсэн бараа (агуулахаас түүх)'))}</h2>
  <table>
    <tr>
      <td class="chk"></td>
      <td class="muted" style="width:120px">SKU</td>
      <td class="muted">${esc(t('Бараа'))}</td>
      <td class="num muted">${esc(t('Тоо'))}</td>
    </tr>
    ${aggRows}
  </table>

  <h2>${esc(t('Захиалга тус бүр (баглах)'))}</h2>
  ${orderBlocks}

  <div class="noprint"><button onclick="window.print()">🖨 ${esc(t('Хэвлэх'))}</button></div>
</body></html>`

  const w = window.open('', '_blank', 'width=800,height=950')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
