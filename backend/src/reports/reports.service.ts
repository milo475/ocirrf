import { Injectable } from '@nestjs/common';
import { parseDateRange } from '../date-range.util';
import { formatShortAddress } from '../orders/address.util';
import { PrismaService } from '../prisma/prisma.service';

const range = (from?: string, to?: string) => parseDateRange(from, to, 30);

const fmtDate = (d: Date | null) =>
  d
    ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ')
    : '';

/** CSV escape: хашилт, таслал, мөр агуулбал давхар хашилтад */
function cell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Excel-д кирилл зөв гарахын тулд UTF-8 BOM-той CSV угсарна */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(cell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const STATUS_MN: Record<string, string> = {
  NEW: 'Шинэ',
  CONFIRMED: 'Баталгаажсан',
  PREPARING: 'Бэлтгэж буй',
  READY: 'Бэлэн',
  COMPLETED: 'Дууссан',
  CANCELLED: 'Цуцлагдсан',
};
const DELIVERY_MN: Record<string, string> = {
  PENDING: 'Хүлээгдэж буй',
  ASSIGNED: 'Хуваарилагдсан',
  ON_THE_WAY: 'Замд яваа',
  DELIVERED: 'Хүргэгдсэн',
  FAILED: 'Амжилтгүй',
};
const REASON_MN: Record<string, string> = {
  PURCHASE_IN: 'Орлого',
  MANUAL_OUT: 'Зарлага',
  CORRECTION: 'Тохируулга',
  INITIAL: 'Эхний орлого',
  ORDER: 'Захиалга',
  ORDER_CANCEL: 'Цуцлалт',
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async deliveryCsv(from?: string, to?: string) {
    const { start, end } = range(from, to);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        assignedDriver: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return toCsv(
      [
        'Захиалгын дугаар',
        'Огноо',
        'Харилцагч',
        'Утас',
        'Хаяг',
        'Барааны тоо',
        'Дүн',
        'Статус',
        'Хүргэлтийн статус',
        'Жолооч',
        'Хүргэсэн огноо',
      ],
      orders.map((o) => [
        o.orderNo,
        fmtDate(o.createdAt),
        o.customerName ?? '',
        o.phone,
        formatShortAddress(o),
        o._count.items,
        String(o.totalAmount),
        STATUS_MN[o.orderStatus] ?? o.orderStatus,
        DELIVERY_MN[o.deliveryStatus] ?? o.deliveryStatus,
        o.assignedDriver?.fullName ?? '',
        fmtDate(o.deliveredAt),
      ]),
    );
  }

  async inventoryCsv(from?: string, to?: string) {
    const { start, end } = range(from, to);
    const moves = await this.prisma.stockMovement.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        product: { select: { name: true, sku: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return toCsv(
      ['Огноо', 'Бараа', 'SKU', 'Өөрчлөлт', 'Шалтгаан', 'Тэмдэглэл', 'Хэрэглэгч'],
      moves.map((m) => [
        fmtDate(m.createdAt),
        m.product?.name ?? '—',
        m.product?.sku ?? '—',
        m.qtyChange,
        REASON_MN[m.reason] ?? m.reason,
        m.note ?? '',
        m.user?.fullName ?? '',
      ]),
    );
  }

  async financeCsv(from?: string, to?: string) {
    const { start, end } = range(from, to);
    const entries = await this.prisma.financeEntry.findMany({
      where: { entryDate: { gte: start, lte: end } },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { entryDate: 'asc' },
    });
    return toCsv(
      ['Огноо', 'Төрөл', 'Ангилал', 'Дүн', 'Тэмдэглэл', 'Бүртгэсэн'],
      entries.map((e) => [
        fmtDate(e.entryDate),
        e.type === 'INCOME' ? 'Орлого' : 'Зарлага',
        e.category,
        String(e.amount),
        e.note ?? '',
        e.createdBy?.fullName ?? '',
      ]),
    );
  }
}
