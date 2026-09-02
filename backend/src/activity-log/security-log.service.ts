import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * АЮУЛГҮЙ БАЙДЛЫН ҮЙЛ ЯВДЛЫГ БҮРТГЭХ (V5).
 *
 * ═══ ЮУГ БҮРТГЭХ ВЭ, ЯАГААД ═══
 * ActivityLogInterceptor нь зөвхөн АМЖИЛТТАЙ өөрчлөлтийг бичдэг
 * бөгөөд `/auth/`-ыг бүрэн алгасдаг. Тиймээс «хэн орох гэж
 * оролдоод чадаагүй», «хэн эрхээсээ хэтрэх гэж үзсэн» гэдгийг
 * мөшгих ямар ч зам байсангүй.
 *
 * Бүртгэх нь:
 *   LOGIN_FAILED   — нууц үг буруу. Хэн нэгэн бодит имэйл мэдэж
 *                    байгаа, эсвэл таамаглаж байгаагийн шинж.
 *   LOGIN_LOCKED   — 5 оролдлогын дараа түгжигдсэн. Довтолгооны
 *                    тод дохио.
 *   FORBIDDEN      — нэвтэрсэн хүн эрхээсээ хэтрэх гэж оролдсон.
 *                    Дотоод эрсдэлийн хамгийн үнэ цэнэтэй дохио.
 *
 * БҮРТГЭХГҮЙ нь: ердийн 401. Токен хугацаа дуусах бүрд гардаг
 * бөгөөд интернэтэд байрлах систем рүү автомат сканнер тасралтгүй
 * ирдэг — тэднийг бичвэл хүснэгт хогоор дүүрч, жинхэнэ дохио
 * дунд нь алдагдана.
 *
 * Бичилт fire-and-forget: алдаа гарсан ч хүсэлтэд нөлөөлөхгүй.
 */
@Injectable()
export class SecurityLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Имэйлийг бүтнээр нь хадгалахгүй — логт хэн нэгний бодит хаяг
   * задрах нь өөрөө эрсдэл. Танихад хангалттай хэлбэрээр богиносгоно:
   *   mnkhochir3@gmail.com → mn***@gmail.com
   */
  private maskEmail(email: string): string {
    const at = email.indexOf('@');
    if (at < 1) return '***';
    const head = email.slice(0, Math.min(2, at));
    return `${head}***${email.slice(at)}`;
  }

  private write(entry: {
    userId?: string | null;
    action: string;
    meta: Prisma.InputJsonValue;
  }) {
    void this.prisma.activityLog
      .create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          entity: 'security',
          meta: entry.meta,
        },
      })
      .catch(() => undefined);
  }

  /** Нууц үг буруу оруулсан */
  loginFailed(email: string, ip: string | null, userId?: string | null) {
    this.write({
      userId,
      action: 'LOGIN_FAILED',
      meta: { email: this.maskEmail(email), ip },
    });
  }

  /** Дараалсан оролдлогын улмаас бүртгэл түгжигдсэн */
  loginLocked(email: string, ip: string | null, userId?: string | null) {
    this.write({
      userId,
      action: 'LOGIN_LOCKED',
      meta: { email: this.maskEmail(email), ip },
    });
  }

  /** Нэвтэрсэн хэрэглэгч эрхээсээ хэтрэх гэж оролдсон */
  forbidden(
    userId: string | null,
    method: string,
    path: string,
    ip: string | null,
  ) {
    this.write({
      userId,
      action: 'FORBIDDEN',
      meta: { method, path, ip },
    });
  }
}
