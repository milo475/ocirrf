import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * И-МЭЙЛ ИЛГЭЭХ ҮЙЛЧИЛГЭЭ (платформын дундын дэд бүтэц).
 *
 * Тохиргоо (.env): SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS,
 * SMTP_SECURE (1 = TLS 465), MAIL_FROM, APP_URL (холбоосын нийтийн хаяг).
 *
 * SMTP_HOST тавиагүй (dev, test) бол «log» горим: захидал илгээгдэхгүй,
 * лог руу хэвлэгдэж `outbox`-д хадгалагдана — e2e тест сэргээх холбоосыг
 * тэндээс уншина. Production-д SMTP заавал; тохируулаагүй бол эхлэхэд
 * анхааруулна (унагахгүй — бусад ажиллагаа и-мэйлээс хамаарахгүй).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  /** «log» горимд илгээсэн захидлууд (сүүлийн 50) — тест/dev */
  readonly outbox: MailMessage[] = [];

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === '1' || port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
          : undefined,
      });
    } else {
      this.transporter = null;
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          'SMTP_HOST тохируулаагүй — и-мэйл (нууц үг сэргээх г.м.) илгээгдэхгүй, зөвхөн лог руу бичигдэнэ',
        );
      }
    }
  }

  /** SMTP тохируулагдсан эсэх — frontend-д «холбоос илгээгдэнэ» гэж хэлэхэд */
  get configured(): boolean {
    return this.transporter !== null;
  }

  get from(): string {
    return process.env.MAIL_FROM ?? 'ocirrf <noreply@ocirrf.mn>';
  }

  /** Холбоос үүсгэх нийтийн хаяг (сүүлийн / -гүй) */
  get appUrl(): string {
    return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  }

  /**
   * Илгээнэ. Алдаа шидэхгүй — дуудагч урсгал (ж: нууц үг сэргээх) и-мэйлийн
   * алдаанаас болж 500 өгөх ёсгүй; алдааг лог руу бичнэ.
   */
  async send(msg: MailMessage): Promise<{ delivered: boolean }> {
    if (!this.transporter) {
      this.outbox.push(msg);
      if (this.outbox.length > 50) this.outbox.shift();
      this.logger.log(`[mail:log] → ${msg.to} | ${msg.subject}\n${msg.text}`);
      return { delivered: false };
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      return { delivered: true };
    } catch (e) {
      this.logger.error(
        `И-мэйл илгээж чадсангүй → ${msg.to}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { delivered: false };
    }
  }
}
