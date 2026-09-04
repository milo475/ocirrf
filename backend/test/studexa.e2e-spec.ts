import 'dotenv/config';
import { deflateSync } from 'node:zlib';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * STUDEXA (app 11) — багшийн системийн e2e: багшийн профайл/код, сурагч,
 * бүлэг, ирц, дүнгийн нэгтгэл, хуваарь, даалгавар (файлтай), сурагчийн
 * нээлттэй бүртгэл + элсэх хүсэлт + портал, файлын эрх, cross-tenant
 * тусгаарлалт (өөр байгууллагын багш 404), эрхийн хязгаар (403).
 */

const T = Date.now().toString().slice(-7);

function makePng(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([t, data]);
    const crcTable: number[] = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable.push(c >>> 0);
    }
    let crc = 0xffffffff;
    for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(24, 0x40)]);
  const raw = Buffer.concat(Array.from({ length: 8 }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PNG = makePng();
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ulaanbaatar',
}).format(new Date());

describe('Studexa — багшийн систем (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;
  const api = () => request(http);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const EMAIL_A = `sx-a-${T}@example.mn`;
  const EMAIL_B = `sx-b-${T}@example.mn`;
  const STUDENT_EMAIL = `sx-stu-${T}@example.mn`;
  let tokA = '';
  let tokB = '';
  let tokS = '';
  let orgAId = '';
  let orgBId = '';
  let codeA = '';
  let s1 = '';
  let s2 = '';
  let columnId = '';
  let lessonId = '';
  let hwId = '';
  let attachmentUrl = '';
  let linkedStudentId = '';

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

    const a = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `Studexa-А ${T}`,
        fullName: 'Багш А',
        email: EMAIL_A,
        password: 'studexa123',
      })
      .expect(201);
    tokA = a.body.accessToken;
    orgAId = a.body.user.organizationId;
    const b = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `Studexa-Б ${T}`,
        fullName: 'Багш Б',
        email: EMAIL_B,
        password: 'studexa123',
      })
      .expect(201);
    tokB = b.body.accessToken;
    orgBId = b.body.user.organizationId;
  });

  afterAll(async () => {
    const orgIds = [orgAId, orgBId].filter(Boolean);
    if (orgIds.length) {
      // Studexa хүснэгтүүд Organization-оос Cascade-аар устана
      await prisma.activityLog.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.user.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('каталогт studexa ACTIVE, 11 дэх байрлалд ⭐', async () => {
    const res = await api().get('/api/platform/apps').expect(200);
    const sx = res.body.find((x: { key: string }) => x.key === 'studexa');
    expect(sx).toMatchObject({
      status: 'ACTIVE',
      sortOrder: 11,
      icon: 'graduation-cap',
    });
  });

  it('ADMIN багшийн эрхтэй ч профайлгүй → me/412; профайл үүсгэхэд trt#### код ⭐', async () => {
    const me = await api().get('/api/studexa/me').set(auth(tokA)).expect(200);
    expect(me.body).toMatchObject({ canTeach: true, teacher: null });
    await api().get('/api/studexa/dashboard').set(auth(tokA)).expect(412);

    const t = await api()
      .post('/api/studexa/teacher')
      .set(auth(tokA))
      .send({ schoolType: 'SCHOOL' })
      .expect(201);
    expect(t.body.code).toMatch(/^trt\d{4}$/);
    codeA = t.body.code;
    // Давхар үүсгэх → 409
    await api()
      .post('/api/studexa/teacher')
      .set(auth(tokA))
      .send({ schoolType: 'SCHOOL' })
      .expect(409);
    // Б өөр код авна (глобал дараалал)
    const tb = await api()
      .post('/api/studexa/teacher')
      .set(auth(tokB))
      .send({ schoolType: 'ACADEMY' })
      .expect(201);
    expect(tb.body.code).toMatch(/^stdx\d{4}$/);
    // Их сургуулийн багш кодгүй → 400
    await api().get('/api/studexa/dashboard').set(auth(tokA)).expect(200);
  });

  it('сурагч, бүлэг (canonical нэр), жагсаалт', async () => {
    const r1 = await api()
      .post('/api/studexa/students')
      .set(auth(tokA))
      .send({ name: 'Анар', group: '10а', phone: '99001122' })
      .expect(201);
    s1 = r1.body.id;
    const r2 = await api()
      .post('/api/studexa/students')
      .set(auth(tokA))
      .send({ name: 'Болор', group: '10А' })
      .expect(201);
    s2 = r2.body.id;
    // «10А» нь байгаа «10а» бүлэгт canonical болно
    expect(r2.body.group).toBe('10а');
    await api()
      .post('/api/studexa/students')
      .set(auth(tokA))
      .send({ name: 'Буруу', group: 'a/b' })
      .expect(400);

    const g = await api()
      .post('/api/studexa/groups')
      .set(auth(tokA))
      .send({ name: '11б' })
      .expect(201);
    expect(g.body.name).toBe('11б');
    const list = await api()
      .get('/api/studexa/students')
      .set(auth(tokA))
      .expect(200);
    expect(list.body.total).toBe(2);
    expect(
      list.body.groupCards
        .map((c: { group: string; n: number }) => `${c.group}:${c.n}`)
        .sort(),
    ).toEqual(['10а:2', '11б:0']);
    await api()
      .get('/api/studexa/students?group=__none__')
      .set(auth(tokA))
      .expect(200)
      .then((r) => expect(r.body.total).toBe(0));
  });

  it('хуанлид байхгүй огноо 400 (2026-13-45, 2026-02-31) — өмнө нь 500/буруу хадгалалт', async () => {
    await api()
      .get('/api/studexa/attendance?date=2026-13-45')
      .set(auth(tokA))
      .expect(400);
    await api()
      .post('/api/studexa/students')
      .set(auth(tokA))
      .send({ name: 'Огноо', enrolled: '2026-02-31' })
      .expect(400);
    await api()
      .post('/api/studexa/homework')
      .set(auth(tokA))
      .send({ target: 'all', date: '2026-99-01', dueDate: TODAY, title: 'x' })
      .expect(400);
  });

  it('ирц бүртгэл — хувь автоматаар, хичээл бүрээр давхардахгүй ⭐', async () => {
    const r = await api()
      .post('/api/studexa/attendance')
      .set(auth(tokA))
      .send({ date: TODAY, statuses: { [s1]: 'PRESENT', [s2]: 'ABSENT' } })
      .expect(201);
    expect(r.body.saved).toBe(2);
    const d2 = await api()
      .get(`/api/studexa/students/${s2}`)
      .set(auth(tokA))
      .expect(200);
    expect(d2.body.student).toMatchObject({
      attendance: 0,
      totalLessons: 1,
      attendedLessons: 0,
    });
    // Хоосон илгээлт → 400
    await api()
      .post('/api/studexa/attendance')
      .set(auth(tokA))
      .send({ date: TODAY, statuses: {} })
      .expect(400);
    // Дахин илгээхэд шинэчлэгдэнэ (давхардахгүй)
    await api()
      .post('/api/studexa/attendance')
      .set(auth(tokA))
      .send({ date: TODAY, statuses: { [s2]: 'LATE' } })
      .expect(201);
    const d2b = await api()
      .get(`/api/studexa/students/${s2}`)
      .set(auth(tokA))
      .expect(200);
    expect(d2b.body.student).toMatchObject({
      attendance: 100,
      totalLessons: 1,
    });
    const page = await api()
      .get(`/api/studexa/attendance?date=${TODAY}`)
      .set(auth(tokA))
      .expect(200);
    expect(
      page.body.rows.find(
        (x: { student: { id: string } }) => x.student.id === s2,
      ).status,
    ).toBe('LATE');
  });

  it('дүнгийн нэгтгэл: багана, оноо, дээд оноо багасгахад хумигдана ⭐', async () => {
    const col = await api()
      .post('/api/studexa/gradebook/columns')
      .set(auth(tokA))
      .send({ name: 'Сорил 1', maxScore: 20 })
      .expect(201);
    columnId = col.body.id;
    const save = await api()
      .post('/api/studexa/gradebook')
      .set(auth(tokA))
      .send({
        cells: [
          { columnId, studentId: s1, value: '18' },
          { columnId, studentId: s2, value: '25' },
        ],
      })
      .expect(201);
    expect(save.body.changed).toBe(2);
    let gb = await api()
      .get('/api/studexa/gradebook?group=10а')
      .set(auth(tokA))
      .expect(200);
    const rowS2 = gb.body.rows.find(
      (r: { student: { id: string } }) => r.student.id === s2,
    );
    expect(rowS2.cells[0].value).toBe(20); // дээд оноонд хумигдсан
    expect(rowS2.attAuto).toBe(true); // ирцийн бүртгэлтэй тул гараар засахгүй

    await api()
      .post('/api/studexa/gradebook')
      .set(auth(tokA))
      .send({ columns: [{ id: columnId, maxScore: 10 }] })
      .expect(201);
    const d1 = await api()
      .get(`/api/studexa/students/${s1}`)
      .set(auth(tokA))
      .expect(200);
    expect(d1.body.scoreTable.rows[0].total).toBe('10 / 10');
    expect(d1.body.progressChart).toBeTruthy();
    gb = await api().get('/api/studexa/gradebook').set(auth(tokA)).expect(200);
    expect(gb.body.columns[0].maxScore).toBe(10);

    // Оноо нэмэх — шинэ баганатай зэрэг
    await api()
      .post(`/api/studexa/students/${s1}/assessments`)
      .set(auth(tokA))
      .send({
        newColumnName: 'Бие даалт',
        newColumnMax: 5,
        date: TODAY,
        score: 4,
      })
      .expect(201);
    await api()
      .post(`/api/studexa/students/${s1}/assessments`)
      .set(auth(tokA))
      .send({ columnId, date: TODAY, score: 99 })
      .expect(400);
    const csv = await api()
      .get('/api/studexa/export/gradebook.csv')
      .set(auth(tokA))
      .expect(200);
    expect(csv.text).toContain('Анар');
    expect(csv.headers['content-type']).toContain('text/csv');
  });

  it('хуваарь: цагийн шалгалт, бүлгээр шүүх, ирцтэй хичээл устгах ⭐', async () => {
    await api()
      .post('/api/studexa/lessons')
      .set(auth(tokA))
      .send({
        title: 'Алгебр',
        weekday: 0,
        startTime: '09:00',
        endTime: '08:00',
      })
      .expect(400);
    await api()
      .post('/api/studexa/lessons')
      .set(auth(tokA))
      .send({
        title: 'Алгебр',
        weekday: 0,
        startTime: '06:00',
        endTime: '08:00',
      })
      .expect(400);
    const l = await api()
      .post('/api/studexa/lessons')
      .set(auth(tokA))
      .send({
        title: 'Алгебр',
        group: '10а',
        weekday: 0,
        startTime: '08:00',
        endTime: '09:30',
      })
      .expect(201);
    lessonId = l.body.id;
    await api()
      .post('/api/studexa/lessons')
      .set(auth(tokA))
      .send({
        title: 'Нийтийн',
        weekday: 1,
        startTime: '10:00',
        endTime: '11:00',
      })
      .expect(201);
    const grid = await api()
      .get('/api/studexa/schedule?group=11б')
      .set(auth(tokA))
      .expect(200);
    expect(grid.body.days[0].lessons).toHaveLength(0); // 10а-гийн хичээл 11б-д харагдахгүй
    expect(grid.body.days[1].lessons).toHaveLength(1); // нийтийнх харагдана
    const svg = await api()
      .get('/api/studexa/export/schedule.svg')
      .set(auth(tokA))
      .expect(200);
    // supertest нь image/* content-type-ыг text биш Buffer body болгодог
    const svgText = Buffer.isBuffer(svg.body)
      ? svg.body.toString('utf8')
      : svg.text;
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('Алгебр');

    // Ерөнхий ирц + тухайн хичээлийн ирц ижил өдөр → хичээл устгахад давхардахгүй
    await api()
      .post('/api/studexa/attendance')
      .set(auth(tokA))
      .send({ date: TODAY, lessonId, statuses: { [s1]: 'ABSENT' } })
      .expect(201);
    const before = await api()
      .get(`/api/studexa/students/${s1}`)
      .set(auth(tokA))
      .expect(200);
    expect(before.body.student.attendance).toBe(0); // хичээлийн бүртгэл ерөнхийг давхардуулахгүй
    await api()
      .delete(`/api/studexa/lessons/${lessonId}`)
      .set(auth(tokA))
      .expect(200);
    const after = await api()
      .get(`/api/studexa/students/${s1}`)
      .set(auth(tokA))
      .expect(200);
    expect(after.body.student).toMatchObject({
      totalLessons: 1,
      attendance: 100,
    });
  });

  it('даалгавар: бүлэгт файлтай өгөх, оноо тавихад «Даалгавар N» багана ⭐', async () => {
    const r = await api()
      .post('/api/studexa/homework')
      .set(auth(tokA))
      .field('target', 'group:10а')
      .field('date', TODAY)
      .field('dueDate', TODAY)
      .field('title', 'Workbook 42-45')
      .attach('attachment', PNG, 'daalgavar.png')
      .expect(201);
    expect(r.body.count).toBe(2);
    // Зураг биш файл → 400
    await api()
      .post('/api/studexa/homework')
      .set(auth(tokA))
      .field('target', 'all')
      .field('date', TODAY)
      .field('dueDate', TODAY)
      .field('title', 'x')
      .attach('attachment', Buffer.from('<html>'), 'evil.png')
      .expect(400);
    // Сурагчгүй бүлэг → 400
    await api()
      .post('/api/studexa/homework')
      .set(auth(tokA))
      .send({ target: 'group:11б', date: TODAY, dueDate: TODAY, title: 'x' })
      .expect(400);

    const list = await api()
      .get('/api/studexa/homework')
      .set(auth(tokA))
      .expect(200);
    expect(list.body.assignments[0]).toMatchObject({
      total: 2,
      submitted: 0,
      graded: 0,
    });
    attachmentUrl = list.body.assignments[0].attachmentUrl;
    expect(attachmentUrl).toMatch(
      /^\/api\/studexa\/files\/sx-[a-f0-9]{32}\.png$/,
    );
    hwId = list.body.assignments[0].items.find(
      (h: { student: { id: string } }) => h.student.id === s1,
    ).id;

    const g = await api()
      .post(`/api/studexa/homework/${hwId}/grade`)
      .set(auth(tokA))
      .send({ score: '16', maxScore: '20' })
      .expect(201);
    expect(g.body).toMatchObject({ score: 16, maxScore: 20 });
    const gb = await api()
      .get('/api/studexa/gradebook')
      .set(auth(tokA))
      .expect(200);
    expect(
      gb.body.columns.some((c: { name: string }) => c.name === 'Даалгавар 1'),
    ).toBe(true);
    const list2 = await api()
      .get('/api/studexa/homework?status=DONE')
      .set(auth(tokA))
      .expect(200);
    expect(list2.body.assignments[0].graded).toBe(1);
    // Оноо хоослох → төлөв буцна
    await api()
      .post(`/api/studexa/homework/${hwId}/grade`)
      .set(auth(tokA))
      .send({ score: '' })
      .expect(201);
    const list3 = await api()
      .get('/api/studexa/homework?status=PENDING')
      .set(auth(tokA))
      .expect(200);
    expect(
      list3.body.assignments[0].items.some(
        (h: { id: string }) => h.id === hwId,
      ),
    ).toBe(true);
    await api()
      .post(`/api/studexa/homework/${hwId}/grade`)
      .set(auth(tokA))
      .send({ score: '12' })
      .expect(201);
  });

  it('сурагчийн нээлттэй бүртгэл → хүсэлт → багш батлах → портал ⭐', async () => {
    await api().get('/api/studexa/teacher-code/nope0000').expect(404);
    const chk = await api()
      .get(`/api/studexa/teacher-code/${codeA}`)
      .expect(200);
    expect(chk.body.teacherName).toBe('Багш А');
    await api()
      .post('/api/studexa/register-student')
      .send({
        teacherCode: 'nope0000',
        email: STUDENT_EMAIL,
        password: 'student123',
        firstName: 'Сурагч',
      })
      .expect(404);
    await api()
      .post('/api/studexa/register-student')
      .send({
        teacherCode: codeA,
        email: STUDENT_EMAIL,
        password: 'student123',
        firstName: 'Анар',
        lastName: 'Дорж',
        phone: '88001122',
        fatherName: 'Дорж',
      })
      .expect(201);
    await api()
      .post('/api/studexa/register-student')
      .send({
        teacherCode: codeA,
        email: STUDENT_EMAIL,
        password: 'student123',
        firstName: 'Давхар',
      })
      .expect(409);

    const login = await api()
      .post('/api/auth/login')
      .send({ email: STUDENT_EMAIL, password: 'student123' })
      .expect(200);
    tokS = login.body.accessToken;
    expect(login.body.user.permissions).toContain('studexa.portal');
    expect(login.body.user.permissions).not.toContain('supplies.view');

    const me = await api().get('/api/studexa/me').set(auth(tokS)).expect(200);
    expect(me.body).toMatchObject({
      canTeach: false,
      canPortal: true,
      pendingRequests: 1,
    });
    const p0 = await api()
      .get('/api/studexa/portal')
      .set(auth(tokS))
      .expect(200);
    expect(p0.body.current).toBeNull();
    expect(p0.body.pending).toHaveLength(1);

    // Багш хүсэлтийг байгаа «Анар» сурагчтай холбоно
    const jrs = await api()
      .get('/api/studexa/join-requests')
      .set(auth(tokA))
      .expect(200);
    expect(jrs.body).toHaveLength(1);
    await api()
      .post(`/api/studexa/join-requests/${jrs.body[0].id}/approve`)
      .set(auth(tokA))
      .send({ studentId: s1 })
      .expect(201);
    linkedStudentId = s1;
    const d1 = await api()
      .get(`/api/studexa/students/${s1}`)
      .set(auth(tokA))
      .expect(200);
    expect(d1.body.student.user.username).toBe(STUDENT_EMAIL);
    expect(d1.body.student.fatherName).toBe('Дорж'); // бүртгэлийн мэдээлэл хуулагдсан

    const portal = await api()
      .get('/api/studexa/portal')
      .set(auth(tokS))
      .expect(200);
    expect(portal.body.current).toMatchObject({
      id: s1,
      name: 'Анар',
      group: '10а',
    });
    expect(portal.body.current.teacher.code).toBe(codeA);
    expect(portal.body.current.homeworks).toHaveLength(1);
    expect(portal.body.current.scoreTable.percent).toBeGreaterThan(0);
    expect(portal.body.current.hidePayment).toBe(false);

    // Даалгавар илгээх (файлгүй, линкгүй → 400; линктэй → OK; төлөв IN_PROGRESS)
    await api()
      .post(`/api/studexa/portal/homework/${hwId}/submit`)
      .set(auth(tokS))
      .send({ comment: 'x' })
      .expect(400);
    await api()
      .post(`/api/studexa/portal/homework/${hwId}/submit`)
      .set(auth(tokS))
      .send({ link: 'https://example.com/work', comment: 'Хийлээ' })
      .expect(201);
    const list = await api()
      .get('/api/studexa/homework')
      .set(auth(tokA))
      .expect(200);
    const mine = list.body.assignments[0].items.find(
      (h: { id: string }) => h.id === hwId,
    );
    expect(mine.submission.link).toBe('https://example.com/work');
    // Багш мэдэгдэл авсан
    const notif = await api()
      .get('/api/notifications?unread=true')
      .set(auth(tokA))
      .expect(200);
    expect(
      notif.body.items.some(
        (n: { type: string }) => n.type === 'STUDEXA_SUBMITTED',
      ),
    ).toBe(true);
  });

  it('файлын эрх: багш ба сурагч 200, өөр байгууллага 403, буруу нэр 400', async () => {
    const path = attachmentUrl.replace(/^\/api/, '/api');
    await api()
      .get(path)
      .set(auth(tokA))
      .expect(200)
      .expect('Content-Type', /image\/png/);
    await api().get(path).set(auth(tokS)).expect(200);
    await api().get(path).set(auth(tokB)).expect(403);
    await api().get(path).expect(401);
    await api()
      .get('/api/studexa/files/..%2F..%2Fetc%2Fpasswd')
      .set(auth(tokA))
      .expect(400);
  });

  it('cross-tenant тусгаарлалт: Б багш А-гийн өгөгдөлд хүрэхгүй ⭐', async () => {
    await api().get(`/api/studexa/students/${s1}`).set(auth(tokB)).expect(404);
    await api()
      .patch(`/api/studexa/students/${s1}`)
      .set(auth(tokB))
      .send({ name: 'Хулгай' })
      .expect(404);
    await api()
      .delete(`/api/studexa/students/${s1}`)
      .set(auth(tokB))
      .expect(404);
    await api()
      .post(`/api/studexa/homework/${hwId}/grade`)
      .set(auth(tokB))
      .send({ score: '1' })
      .expect(404);
    const gB = await api()
      .get('/api/studexa/groups/10а')
      .set(auth(tokB))
      .expect(200);
    expect(gB.body.students).toHaveLength(0);
    const listB = await api()
      .get('/api/studexa/students')
      .set(auth(tokB))
      .expect(200);
    expect(listB.body.total).toBe(0);
    // Б багшийн кодоор А-гийн сурагч (өөр байгууллага) хүсэлт илгээж чадахгүй
    const tb = await api().get('/api/studexa/me').set(auth(tokB)).expect(200);
    await api()
      .post('/api/studexa/portal/join')
      .set(auth(tokS))
      .send({ code: tb.body.teacher.code })
      .expect(404);
  });

  it('эрхийн хязгаар: сурагч багшийн endpoint-д 403, ursgal-ийн нийлүүлэлт 403', async () => {
    await api().get('/api/studexa/students').set(auth(tokS)).expect(403);
    await api()
      .post('/api/studexa/teacher')
      .set(auth(tokS))
      .send({ schoolType: 'SCHOOL' })
      .expect(403);
    await api().get('/api/supplies').set(auth(tokS)).expect(403);
    // Багш порталын эрхгүй (MANAGER/ADMIN default-д portal байхгүй; ADMIN бүгдтэй тул Б-г шалгахгүй)
    // Сурагч багшаас салах → портал хоосон, багш мэдэгдэл авна
    await api()
      .post(`/api/studexa/portal/leave/${linkedStudentId}`)
      .set(auth(tokS))
      .expect(201);
    const p = await api()
      .get('/api/studexa/portal')
      .set(auth(tokS))
      .expect(200);
    expect(p.body.current).toBeNull();
    const d1 = await api()
      .get(`/api/studexa/students/${s1}`)
      .set(auth(tokA))
      .expect(200);
    expect(d1.body.student.userId).toBeNull();
  });

  it('зарлал, тэмдэглэл, төлбөр, экспорт', async () => {
    const ann = await api()
      .post('/api/studexa/announcements')
      .set(auth(tokA))
      .send({ text: 'Маргааш сорил', group: '10а' })
      .expect(201);
    await api()
      .get('/api/studexa/announcements')
      .set(auth(tokA))
      .expect(200)
      .then((r) => expect(r.body.items).toHaveLength(1));
    await api()
      .delete(`/api/studexa/announcements/${ann.body.id}`)
      .set(auth(tokB))
      .expect(200); // Б-д олдохгүй, устгахгүй
    await api()
      .get('/api/studexa/announcements')
      .set(auth(tokA))
      .expect(200)
      .then((r) => expect(r.body.items).toHaveLength(1));
    const note = await api()
      .post('/api/studexa/notes')
      .set(auth(tokA))
      .send({ title: 'Анар', text: 'Эцэг эхтэй ярих' })
      .expect(201);
    await api()
      .patch(`/api/studexa/notes/${note.body.id}`)
      .set(auth(tokA))
      .send({ title: 'Анар', text: 'Ярьсан' })
      .expect(200);
    await api()
      .post(`/api/studexa/students/${s2}/payments`)
      .set(auth(tokA))
      .send({ month: 3, status: 'OVERDUE' })
      .expect(201);
    let d2 = await api()
      .get(`/api/studexa/students/${s2}`)
      .set(auth(tokA))
      .expect(200);
    expect(d2.body.student.paymentStatus).toBe('OVERDUE');
    await api()
      .delete(`/api/studexa/students/${s2}/payments/3`)
      .set(auth(tokA))
      .expect(200);
    await api()
      .post(`/api/studexa/students/${s2}/payments`)
      .set(auth(tokA))
      .send({ month: 4, status: 'PAID' })
      .expect(201);
    d2 = await api()
      .get(`/api/studexa/students/${s2}`)
      .set(auth(tokA))
      .expect(200);
    expect(d2.body.student.paymentStatus).toBe('PAID');
    const csv = await api()
      .get('/api/studexa/export/attendance.csv?group=10а')
      .set(auth(tokA))
      .expect(200);
    expect(csv.text).toContain('Ирц %');
    const dash = await api()
      .get('/api/studexa/dashboard')
      .set(auth(tokA))
      .expect(200);
    expect(dash.body).toMatchObject({ totalStudents: 2 });
    expect(dash.body.attChart).toBeTruthy();
    expect(dash.body.groupBars[0]).toMatchObject({ label: '10а' });
  });
});
