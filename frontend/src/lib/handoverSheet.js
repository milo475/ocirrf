/**
 * Жолоочид бараа хүлээлгэн өгсөн хуудас — хэвлэх цонх (V5).
 * Дээр нь нэгтгэсэн барааны жагсаалт, доор нь захиалга тус бүр,
 * төгсгөлд нь хоёр талын гарын үсгийн зай (цаасан дээр нь зурна).
 */
import { formatDateTime } from './format'

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )

export function openHandoverSheet(h, t) {
  const totals = h.totals
    .map(
      (i) => `<tr>
        <td>${esc(i.name)}</td>
        <td class="num"><b>${i.qty}</b></td>
      </tr>`,
    )
    .join('')

  const orders = h.orders
    .map(
      (o) => `<tr>
        <td class="mono">${esc(o.orderNo)}</td>
        <td>${esc(o.customerName ?? '')}<br><span class="muted mono">${esc(o.phone)}</span></td>
        <td>${o.items.map((i) => `${esc(i.productName)} ×${i.qty}`).join('<br>')}</td>
      </tr>`,
    )
    .join('')

  // Гарын үсгийг ЦААСАН дээр нь гараар зурна — хоосон зай + нэрийн мөр
  const sig = (name, role) => `
    <div class="sig">
      <p class="muted">${esc(role)}</p>
      <div class="sigbox"></div>
      <p class="line">${esc(name)}</p>
    </div>`

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(h.number)}</title>
<style>
  body { font-family: 'Noto Sans', sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em;
       color: #666; margin: 24px 0 4px; }
  .muted { color: #666; font-size: 12px; }
  .mono { font-family: ui-monospace, monospace; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #111; padding-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 13px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; color: #666;
       border-bottom: 1px solid #ccc; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .sigs { display: flex; gap: 40px; margin-top: 40px; }
  .sig { flex: 1; text-align: center; }
  .sigbox { height: 70px; }
  .line { border-top: 1px solid #111; margin: 4px 0 0; padding-top: 4px; font-size: 13px; }
  @media print { body { margin: 12mm; } .noprint { display: none; } }
  .noprint { margin-top: 28px; }
  .noprint button { padding: 8px 20px; font-size: 14px; }
</style></head><body>
  <div class="head">
    <div>
      <h1>${esc(t('Бараа хүлээлгэн өгсөн хуудас'))}</h1>
      <p class="muted mono">${esc(h.number)}</p>
    </div>
    <div style="text-align:right">
      <p class="muted">${esc(t('Жолооч'))}: <b>${esc(h.driver?.fullName ?? '')}</b></p>
      <p class="muted">${esc(t('Нярав'))}: ${esc(h.keeper?.fullName ?? '')}</p>
      <p class="muted mono">${esc(formatDateTime(h.handedAt ?? h.createdAt))}</p>
    </div>
  </div>

  <h2>${esc(t('Нийт хүлээлгэн өгсөн бараа'))}</h2>
  <table>
    <thead><tr><th>${esc(t('Бараа'))}</th><th class="num">${esc(t('Тоо'))}</th></tr></thead>
    <tbody>${totals}</tbody>
  </table>

  <h2>${esc(t('Захиалга тус бүр'))} (${h.orders.length})</h2>
  <table>
    <thead><tr>
      <th>${esc(t('№'))}</th><th>${esc(t('Хүлээн авагч'))}</th><th>${esc(t('Бараа'))}</th>
    </tr></thead>
    <tbody>${orders}</tbody>
  </table>

  ${h.note ? `<p class="muted" style="margin-top:16px">✎ ${esc(h.note)}</p>` : ''}

  <div class="sigs">
    ${sig(h.keeper?.fullName ?? '', t('Хүлээлгэн өгсөн (нярав)'))}
    ${sig(h.driver?.fullName ?? '', t('Хүлээн авсан (жолооч)'))}
  </div>

  <div class="noprint"><button onclick="window.print()">🖨 ${esc(t('Хэвлэх'))}</button></div>
</body></html>`

  const w = window.open('', '_blank', 'width=820,height=950')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
