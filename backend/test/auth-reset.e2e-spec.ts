import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * НУУЦ ҮГ СЭРГЭЭХ (и-мэйлээр) — forgot-password → холбоос (log горимын
 * outbox-оос) → reset-password → шинэ нууц үгээр нэвтрэх; хуучин refresh
 * token унтарна; token нэг удаагийн + буруу token 400; байхгүй и-мэйл ч
 * ижил 200 (enumeration хаалттай).
 */
const T = Date.now().toString().slice(-7);

describe('Нууц үг сэргээх (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;
  let mail: MailService;
  const api = () => request(http);
  const EMAIL = `reset-${T}@example.mn`;
  let orgId = '';
  let refreshToken = '';
  let token = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    mail = app.get(MailService);
    const a = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `Reset ${T}`,
        fullName: 'Сэргээгч',
        email: EMAIL,
        password: 'oldpass123',
      })
      .expect(201);
    orgId = a.body.user.organizationId;
    refreshToken = a.body.refreshToken;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.activityLog.deleteMany({ where: { organizationId: orgId } });
      await prisma.user.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('forgot-password: бүртгэлгүй и-мэйлд ч 200, захидал илгээгдэхгүй', async () => {
    const before = mail.outbox.length;
    const res = await api()
      .post('/api/auth/forgot-password')
      .send({ email: `nobody-${T}@example.mn` })
      .expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(mail.outbox.length).toBe(before);
    await api()
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('forgot-password: бүртгэлтэй и-мэйлд сэргээх холбоостой захидал ⭐', async () => {
    await api()
      .post('/api/auth/forgot-password')
      .send({ email: EMAIL.toUpperCase() })
      .expect(200);
    const sent = mail.outbox[mail.outbox.length - 1];
    expect(sent.to).toBe(EMAIL);
    expect(sent.subject).toContain('нууц үг');
    const m = sent.text.match(/\/reset-password\?token=([A-Za-z0-9_-]+)/);
    expect(m).toBeTruthy();
    token = m![1];
    // DB-д hash л хадгалагдана
    const rows = await prisma.passwordResetToken.findMany({
      where: { user: { username: EMAIL } },
    });
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
    expect(rows.filter((r) => r.usedAt === null)).toHaveLength(1);
  });

  it('дахин хүсэлт илгээвэл өмнөх token хүчингүй болно', async () => {
    const oldToken = token;
    await api()
      .post('/api/auth/forgot-password')
      .send({ email: EMAIL })
      .expect(200);
    const sent = mail.outbox[mail.outbox.length - 1];
    token = sent.text.match(/token=([A-Za-z0-9_-]+)/)![1];
    expect(token).not.toBe(oldToken);
    await api()
      .post('/api/auth/reset-password')
      .send({ token: oldToken, password: 'newpass123' })
      .expect(400);
  });

  it('reset-password: буруу token 400, богино нууц үг 400', async () => {
    await api()
      .post('/api/auth/reset-password')
      .send({ token: 'x'.repeat(40), password: 'newpass123' })
      .expect(400);
    await api()
      .post('/api/auth/reset-password')
      .send({ token, password: '123' })
      .expect(400);
  });

  it('reset-password: шинэ нууц үг → нэвтэрнэ, хуучин unauthorized, refresh унтарсан, token нэг удаагийн ⭐', async () => {
    await api()
      .post('/api/auth/reset-password')
      .send({ token, password: 'newpass123' })
      .expect(200);
    await api()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'oldpass123' })
      .expect(401);
    await api()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'newpass123' })
      .expect(200);
    // Өмнөх session-ий refresh token revoke хийгдсэн
    await api().post('/api/auth/refresh').send({ refreshToken }).expect(401);
    // Token дахин ашиглагдахгүй
    await api()
      .post('/api/auth/reset-password')
      .send({ token, password: 'another123' })
      .expect(400);
    // Аудитын лог
    const logs = await prisma.activityLog.findMany({
      where: { organizationId: orgId, entity: 'security' },
    });
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining(['password_reset_requested', 'password_reset']),
    );
  });

  it('хугацаа дууссан token 400', async () => {
    await api()
      .post('/api/auth/forgot-password')
      .send({ email: EMAIL })
      .expect(200);
    const t2 = mail.outbox[mail.outbox.length - 1].text.match(
      /token=([A-Za-z0-9_-]+)/,
    )![1];
    await prisma.passwordResetToken.updateMany({
      where: { user: { username: EMAIL }, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await api()
      .post('/api/auth/reset-password')
      .send({ token: t2, password: 'newpass456' })
      .expect(400);
  });
});
