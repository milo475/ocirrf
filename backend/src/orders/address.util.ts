import type { DeliveryRegion } from '../generated/prisma/client';

type AddressFields = {
  region: DeliveryRegion;
  district?: string | null;
  khoroo?: string | null;
  building?: string | null;
  entrance?: string | null;
  floor?: string | null;
  door?: string | null;
  province?: string | null;
  soum?: string | null;
  transport?: string | null;
  addressDetail?: string | null;
};

/**
 * Бүтэцлэгдсэн хаягийг хүнд уншигдах нэг мөр болгоно.
 * УБ:          "ХУД, 11-р хороо, Гоёо хотхон 45-р байр, 2-р орц, 5 давхар, 501 тоот"
 * Орон нутаг:  "Архангай, Эрдэнэбулган сум — Тээвэр: Од транс, <дэлгэрэнгүй>"
 */
export function formatFullAddress(a: AddressFields): string {
  if (a.region === 'ULAANBAATAR') {
    const parts = [
      a.district,
      a.khoroo ? `${a.khoroo}-р хороо` : null,
      a.building,
      a.entrance ? `${a.entrance}-р орц` : null,
      a.floor ? `${a.floor} давхар` : null,
      a.door ? `${a.door} тоот` : null,
    ].filter(Boolean);
    return parts.join(', ');
  }

  const base = [
    a.province,
    a.soum ? `${a.soum} сум` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const withTransport = a.transport
    ? `${base} — Тээвэр: ${a.transport}`
    : base;
  return a.addressDetail
    ? `${withTransport}, ${a.addressDetail}`
    : withTransport;
}
