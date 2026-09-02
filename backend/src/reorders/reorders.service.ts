import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { OrderStatus } from '../generated/prisma/client';

/** Сануулгын яаралтай байдал */
export type ReorderState = 'OVERDUE' | 'DUE' | 'SOON';

const DAY = 86_400_000;

@Injectable()
export class ReordersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async config() {
    const num = async (key: string, fallback: number) => {
      const n = parseInt(await this.settings.get(key), 10);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    return {
      defaultDays: await num('defaultDaysSupply', 30),
      lead: await num('reorderLeadDays', 7),
      maxOverdue: await num('reorderMaxOverdue', 60),
    };
  }

  /**
   * ДАХИН ЗАХИАЛАХ ДӨХСӨН ҮЙЛЧЛҮҮЛЭГЧИД.
   *
   * ЗАРЧИМ: нэмэлт бүтээгдэхүүнийг хүн тодорхой хоногт дуусгадаг.
   * Тиймээс «хэзээ дуусах» нь тооцоолж болдог: захиалсан огноо +
   * (тоо × тухайн барааны хоног). Хамгийн ЭХЭЛЖ дуусах бараагаар
   * сануулна — хүн тэрийгээ дуусгамагц дахин хэрэгтэй болно.
   *
   * ЗӨВХӨН СҮҮЛИЙН захиалгыг харна: хэрэв хүн дараа нь дахин авсан
   * бол аль хэдийн шинэчилсэн гэсэн үг, сануулах шаардлагагүй.
   */
  async due() {
    const cfg = await this.config();

    // Хэрэглээний хугацаа: бараанд заасан нь давамгайлна, 0 бол хасна
    const products = await this.prisma.product.findMany({
      select: { id: true, name: true, daysSupply: true },
    });
    const supplyDays = new Map<string, number>();
    for (const p of products) {
      supplyDays.set(p.id, p.daysSupply ?? cfg.defaultDays);
    }

    // Цуцлагдсанаас бусад бүх захиалга, шинэ нь эхэндээ
    const orders = await this.prisma.order.findMany({
      where: { orderStatus: { not: OrderStatus.CANCELLED } },
      select: {
        id: true,
        orderNo: true,
        phone: true,
        customerName: true,
        createdAt: true,
        totalAmount: true,
        items: { select: { productId: true, productName: true, qty: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    /** Утсаар бүлэглэнэ — Customer хүснэгт байхгүй, утас нь таних тэмдэг */
    const byPhone = new Map<string, typeof orders>();
    for (const o of orders) {
      const list = byPhone.get(o.phone);
      if (list) list.push(o);
      else byPhone.set(o.phone, [o]);
    }

    const now = Date.now();
    const rows: Array<{
      phone: string;
      customerName: string | null;
      lastOrderId: string;
      lastOrderNo: string;
      lastOrderAt: Date;
      productName: string;
      qty: number;
      runsOutAt: Date;
      daysLeft: number;
      state: ReorderState;
      orderCount: number;
      totalSpent: number;
    }> = [];

    for (const [phone, list] of byPhone) {
      const last = list[0]; // orderBy desc тул эхнийх нь хамгийн сүүлийнх

      // Хамгийн эхэлж дуусах мөрийг олно
      let soonest: { name: string; qty: number; at: number } | null = null;
      for (const i of last.items) {
        const days = supplyDays.get(i.productId);
        if (!days) continue; // 0 эсвэл бараа устсан — тооцоонд оруулахгүй
        const at = last.createdAt.getTime() + i.qty * days * DAY;
        if (!soonest || at < soonest.at) {
          soonest = { name: i.productName, qty: i.qty, at };
        }
      }
      if (!soonest) continue; // энэ захиалгад хэрэглээний бараа алга

      const daysLeft = Math.round((soonest.at - now) / DAY);
      if (daysLeft > cfg.lead) continue; // хараахан эрт
      if (daysLeft < -cfg.maxOverdue) continue; // хэтэрхий хоцорсон — хаясан

      rows.push({
        phone,
        customerName: last.customerName,
        lastOrderId: last.id,
        lastOrderNo: last.orderNo,
        lastOrderAt: last.createdAt,
        productName: soonest.name,
        qty: soonest.qty,
        runsOutAt: new Date(soonest.at),
        daysLeft,
        state: daysLeft < 0 ? 'OVERDUE' : daysLeft === 0 ? 'DUE' : 'SOON',
        orderCount: list.length,
        totalSpent: list.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      });
    }

    // Хамгийн их хоцорсон нь эхэндээ — тэднийг алдах эрсдэл өндөр
    rows.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      leadDays: cfg.lead,
      defaultDaysSupply: cfg.defaultDays,
      overdue: rows.filter((r) => r.state === 'OVERDUE').length,
      due: rows.filter((r) => r.state !== 'OVERDUE').length,
      rows,
    };
  }
}
