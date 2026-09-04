import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * STUDEXA — НЭГДСЭН АНГИ (сургуулийн түвшин): анги үүсгэх (studexa.manage),
 * ангийн багш (homeroom) ба хичээлийн багш, сурагчийн мастер бүртгэл → багш
 * бүрийн roster автоматаар, профайл хоёр чиглэлд тархах, нэгдсэн дүн/ирц/
 * хуваарь, анги нэр солиход бүлэг/хуваарь дагах, акаунт холбох (элсэх хүсэлт
 * батлахад мастерт тархах, и-мэйлээр холбох), ангиас гаргах/устгах,
 * CSV импорт, эрхийн хязгаар (MANAGER 403, cross-tenant 404).
 */
const T = Date.now().toString().slice(-7);

describe('Studexa — нэгдсэн анги (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;
  const api = () => request(http);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const EMAIL_A = `sxs-a-${T}@example.mn`;
  const EMAIL_M = `sxs-m-${T}@example.mn`;
  const EMAIL_B = `sxs-b-${T}@example.mn`;
  const EMAIL_S = `sxs-s-${T}@example.mn`;
  let tokA = '';
  let tokM = '';
  let tokB = '';
  let tokS = '';
  let orgAId = '';
  let orgBId = '';
  let codeA = '';
  let teacherA = '';
  let teacherM = '';
  let subjectA = '';
  let classId = '';
  let pupil1 = ''; // Дорж
  let pupil2 = ''; // Сүрэн
  let rosterA1 = ''; // А багшийн Дорж мөр
  let userS = '';

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
        orgName: `Сургууль-А ${T}`,
        fullName: 'Захирал А',
        email: EMAIL_A,
        password: 'studexa123',
      })
      .expect(201);
    tokA = a.body.accessToken;
    orgAId = a.body.user.organizationId;
    const b = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `Сургууль-Б ${T}`,
        fullName: 'Багш Б',
        email: EMAIL_B,
        password: 'studexa123',
      })
      .expect(201);
    tokB = b.body.accessToken;
    orgBId = b.body.user.organizationId;

    // Багш А (ADMIN — studexa.manage default) профайл + хичээл
    const t = await api()
      .post('/api/studexa/teacher')
      .set(auth(tokA))
      .send({ schoolType: 'SCHOOL' })
      .expect(201);
    codeA = t.body.code;
    teacherA = t.body.id;
    const subj = await api()
      .post('/api/studexa/subjects')
      .set(auth(tokA))
      .send({ name: 'Математик' })
      .expect(201);
    subjectA = subj.body.id;

    // Багш М (MANAGER — studexa.teach бий, studexa.manage байхгүй)
    await api()
      .post('/api/users')
      .set(auth(tokA))
      .send({
        email: EMAIL_M,
        name: 'Багш М',
        password: 'manager123',
        role: 'MANAGER',
      })
      .expect(201);
    const lm = await api()
      .post('/api/auth/login')
      .send({ email: EMAIL_M, password: 'manager123' })
      .expect(200);
    tokM = lm.body.accessToken;
    const tm = await api()
      .post('/api/studexa/teacher')
      .set(auth(tokM))
      .send({ schoolType: 'SCHOOL' })
      .expect(201);
    teacherM = tm.body.id;
  });

  afterAll(async () => {
    const orgIds = [orgAId, orgBId].filter(Boolean);
    if (orgIds.length) {
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

  it('анги үүсгэх: MANAGER 403, ADMIN 201; ангийн багш автоматаар гишүүн, бүлэг үүснэ ⭐', async () => {
    await api()
      .post('/api/studexa/school/classes')
      .set(auth(tokM))
      .send({ name: '10в', grade: 10 })
      .expect(403);
    const c = await api()
      .post('/api/studexa/school/classes')
      .set(auth(tokA))
      .send({ name: '10в', grade: 10, homeroomTeacherId: teacherM })
      .expect(201);
    classId = c.body.id;
    await api()
      .post('/api/studexa/school/classes')
      .set(auth(tokA))
      .send({ name: '10в' })
      .expect(409);
    await api()
      .post('/api/studexa/school/classes')
      .set(auth(tokA))
      .send({ name: 'a/b' })
      .expect(400);
    // М-ийн бүлгүүдэд «10в» орсон
    const g = await api()
      .get('/api/studexa/groups')
      .set(auth(tokM))
      .expect(200);
    expect(g.body.names).toContain('10в');
    // М өөрийн анги гэж харна, засах эрхгүй (нэр солих нь удирдлагынх)
    const list = await api()
      .get('/api/studexa/school/classes')
      .set(auth(tokM))
      .expect(200);
    expect(list.body.canManage).toBe(false);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      name: '10в',
      isHomeroom: true,
      teachers: 1,
    });
    await api()
      .patch(`/api/studexa/school/classes/${classId}`)
      .set(auth(tokM))
      .send({ name: '10г' })
      .expect(403);
    // Б байгууллага харахгүй
    await api()
      .get(`/api/studexa/school/classes/${classId}`)
      .set(auth(tokB))
      .expect(404);
  });

  it('хичээлийн багш нэмэх, сурагчийн мастер → багш бүрийн roster автоматаар ⭐', async () => {
    await api()
      .post(`/api/studexa/school/classes/${classId}/teachers`)
      .set(auth(tokM))
      .send({ teacherId: teacherA })
      .expect(403);
    // Хичээл багшийнх биш → 400
    await api()
      .post(`/api/studexa/school/classes/${classId}/teachers`)
      .set(auth(tokA))
      .send({ teacherId: teacherM, subjectId: subjectA })
      .expect(400);
    await api()
      .post(`/api/studexa/school/classes/${classId}/teachers`)
      .set(auth(tokA))
      .send({ teacherId: teacherA, subjectId: subjectA })
      .expect(201);
    // Удирдлага нэмнэ, ангийн багш ч нэмнэ
    const p1 = await api()
      .post(`/api/studexa/school/classes/${classId}/pupils`)
      .set(auth(tokA))
      .send({
        name: 'Дорж',
        registerNo: 'АА00',
        birthDate: '2010-02-02',
        gender: 'MALE',
      })
      .expect(201);
    pupil1 = p1.body.id;
    const p2 = await api()
      .post(`/api/studexa/school/classes/${classId}/pupils`)
      .set(auth(tokM))
      .send({ name: 'Сүрэн', phone: '99887766' })
      .expect(201);
    pupil2 = p2.body.id;
    // CSV импорт (ангийн багш)
    const imp = await api()
      .post(`/api/studexa/school/classes/${classId}/pupils/import`)
      .set(auth(tokM))
      .attach(
        'file',
        Buffer.from(
          'нэр,төрсөн огноо,хүйс\nИмпорт А,2010-01-01,эм\n,2010-01-01,\nИмпорт Б,,\n',
          'utf8',
        ),
        'p.csv',
      )
      .expect(201);
    expect(imp.body).toMatchObject({ created: 2 });
    expect(imp.body.skipped).toHaveLength(1);

    for (const tok of [tokA, tokM]) {
      const st = await api()
        .get('/api/studexa/students?group=10в&limit=100')
        .set(auth(tok))
        .expect(200);
      expect(st.body.total).toBe(4);
      expect(
        st.body.items.every((s: { pupilId: string | null }) => s.pupilId),
      ).toBe(true);
      expect(
        st.body.items.find((s: { name: string }) => s.name === 'Дорж'),
      ).toMatchObject({
        registerNo: 'АА00',
        birthDate: '2010-02-02',
        gender: 'MALE',
      });
    }
    const stA = await api()
      .get('/api/studexa/students?group=10в&limit=100')
      .set(auth(tokA))
      .expect(200);
    rosterA1 = stA.body.items.find(
      (s: { name: string }) => s.name === 'Дорж',
    ).id;

    const detail = await api()
      .get(`/api/studexa/school/classes/${classId}`)
      .set(auth(tokM))
      .expect(200);
    expect(detail.body.canWrite).toBe(true);
    expect(detail.body.canManage).toBe(false);
    expect(detail.body.teachers).toHaveLength(2);
    expect(detail.body.pupils).toHaveLength(4);
    expect(
      detail.body.pupils.find((p: { id: string }) => p.id === pupil1).rosters,
    ).toBe(2);
  });

  it('профайл хоёр чиглэлд тархана: мастер засах → roster; багш roster засах → мастер + бусад багш ⭐', async () => {
    await api()
      .patch(`/api/studexa/school/pupils/${pupil1}`)
      .set(auth(tokM))
      .send({ name: 'Дорж Б', registerNo: 'АА01', fatherName: 'Бат' })
      .expect(200);
    const a1 = await api()
      .get(`/api/studexa/students/${rosterA1}`)
      .set(auth(tokA))
      .expect(200);
    expect(a1.body.student).toMatchObject({
      name: 'Дорж Б',
      registerNo: 'АА01',
      fatherName: 'Бат',
    });
    // Багш А өөрийн roster-оо засна → мастер + М-ийн roster дагана
    await api()
      .patch(`/api/studexa/students/${rosterA1}`)
      .set(auth(tokA))
      .send({ name: 'Дорж В', group: '10в', phone: '88001122' })
      .expect(200);
    const master = await api()
      .get(`/api/studexa/school/pupils/${pupil1}`)
      .set(auth(tokM))
      .expect(200);
    expect(master.body.pupil).toMatchObject({
      name: 'Дорж В',
      phone: '88001122',
      registerNo: 'АА01',
    });
    const stM = await api()
      .get('/api/studexa/students?group=10в&limit=100')
      .set(auth(tokM))
      .expect(200);
    expect(
      stM.body.items.some(
        (s: { name: string; phone: string }) =>
          s.name === 'Дорж В' && s.phone === '88001122',
      ),
    ).toBe(true);
  });

  it('нэгдсэн ирц, дүн, хуваарь; анги нэр солиход бүлэг/хуваарь дагана ⭐', async () => {
    const stA = await api()
      .get('/api/studexa/students?group=10в&limit=100')
      .set(auth(tokA))
      .expect(200);
    const rosterA2 = stA.body.items.find(
      (s: { name: string }) => s.name === 'Сүрэн',
    ).id;
    await api()
      .post('/api/studexa/attendance')
      .set(auth(tokA))
      .send({
        date: '2026-09-07',
        group: '10в',
        statuses: { [rosterA1]: 'PRESENT', [rosterA2]: 'ABSENT' },
      })
      .expect(201);
    const col = await api()
      .post('/api/studexa/gradebook/columns')
      .set(auth(tokA))
      .send({ name: 'Сорил', maxScore: 10, subjectId: subjectA })
      .expect(201);
    await api()
      .post('/api/studexa/gradebook?group=10в')
      .set(auth(tokA))
      .send({
        cells: [{ columnId: col.body.id, studentId: rosterA1, value: '9' }],
      })
      .expect(201);
    // Хуваарь: А — 10в бүлэгт, М — бүх бүлэгт
    await api()
      .post('/api/studexa/lessons')
      .set(auth(tokA))
      .send({
        title: 'Математик',
        group: '10в',
        weekday: 1,
        startTime: '08:00',
        endTime: '08:40',
        subjectId: subjectA,
      })
      .expect(201);
    await api()
      .post('/api/studexa/lessons')
      .set(auth(tokM))
      .send({
        title: 'Ангийн цаг',
        weekday: 2,
        startTime: '09:00',
        endTime: '09:40',
      })
      .expect(201);

    const detail = await api()
      .get(`/api/studexa/school/classes/${classId}`)
      .set(auth(tokA))
      .expect(200);
    const dorj = detail.body.pupils.find(
      (p: { id: string }) => p.id === pupil1,
    );
    expect(dorj.attendance).toMatchObject({
      attended: 1,
      total: 1,
      percent: 100,
    });
    expect(detail.body.timetable.days[1].lessons[0].lesson).toMatchObject({
      title: 'Математик',
      teacherName: 'Захирал А',
    });
    expect(detail.body.timetable.days[2].lessons[0].lesson).toMatchObject({
      title: 'Ангийн цаг',
      teacherName: 'Багш М',
    });

    const pd = await api()
      .get(`/api/studexa/school/pupils/${pupil1}`)
      .set(auth(tokM))
      .expect(200);
    expect(pd.body.rosters).toHaveLength(2);
    expect(
      pd.body.rosters.find(
        (r: { teacher: { id: string } }) => r.teacher.id === teacherA,
      ),
    ).toMatchObject({ subject: 'Математик', attendance: 100 });
    expect(pd.body.attendances[0]).toMatchObject({
      date: '2026-09-07',
      status: 'PRESENT',
      teacherName: 'Захирал А',
    });
    const secA = pd.body.report.sections.find(
      (s: { teacher: { id: string } }) => s.teacher.id === teacherA,
    );
    expect(secA.card).toMatchObject({
      earned: 9,
      possible: 10,
      percent: 90,
      letter: 'A',
    });
    expect(pd.body.report.percent).toBe(90); // М оноо тавиагүй → дундажид орохгүй
    expect(pd.body.timetable.days[1].lessons).toHaveLength(1);

    // Нэр солих (удирдлага) → бүлэг, roster, хуваарь дагана
    await api()
      .patch(`/api/studexa/school/classes/${classId}`)
      .set(auth(tokA))
      .send({ name: '10г', grade: 10, homeroomTeacherId: teacherM })
      .expect(200);
    const gA = await api()
      .get('/api/studexa/groups')
      .set(auth(tokA))
      .expect(200);
    expect(gA.body.names).toContain('10г');
    expect(gA.body.names).not.toContain('10в');
    const st = await api()
      .get('/api/studexa/students?group=10г&limit=100')
      .set(auth(tokA))
      .expect(200);
    expect(st.body.total).toBe(4);
    const grid = await api()
      .get('/api/studexa/schedule?group=10г')
      .set(auth(tokA))
      .expect(200);
    expect(JSON.stringify(grid.body)).toContain('Математик');
  });

  it('акаунт холбох: элсэх хүсэлт батлахад мастер + бусад багшийн roster; и-мэйлээр холбох; портал «Миний анги» ⭐', async () => {
    const reg = await api()
      .post('/api/studexa/register-student')
      .send({
        teacherCode: codeA,
        email: EMAIL_S,
        password: 'student123',
        firstName: 'Дорж',
        lastName: 'Бат',
      })
      .expect(201);
    expect(reg.status).toBe(201);
    const ls = await api()
      .post('/api/auth/login')
      .send({ email: EMAIL_S, password: 'student123' })
      .expect(200);
    tokS = ls.body.accessToken;
    const jrs = await api()
      .get('/api/studexa/students')
      .set(auth(tokA))
      .expect(200);
    expect(jrs.body.joinRequests).toHaveLength(1);
    userS = jrs.body.joinRequests[0].userId ?? jrs.body.joinRequests[0].user.id;
    await api()
      .post(`/api/studexa/join-requests/${jrs.body.joinRequests[0].id}/approve`)
      .set(auth(tokA))
      .send({ studentId: rosterA1 })
      .expect(201);
    const pd = await api()
      .get(`/api/studexa/school/pupils/${pupil1}`)
      .set(auth(tokA))
      .expect(200);
    expect(pd.body.pupil.userId).toBe(userS);
    expect(
      pd.body.rosters.every(
        (r: { userId: string | null }) => r.userId === userS,
      ),
    ).toBe(true);
    // Сурагчийн портал: 2 багшийн бүртгэл + ангийн нэгдсэн мэдээлэл
    const portal = await api()
      .get('/api/studexa/portal')
      .set(auth(tokS))
      .expect(200);
    expect(portal.body.records).toHaveLength(2);
    const school = await api()
      .get('/api/studexa/portal/school')
      .set(auth(tokS))
      .expect(200);
    expect(school.body.class.name).toBe('10г');
    expect(school.body.homeroom.name).toBe('Багш М');
    expect(school.body.teachers).toHaveLength(2);
    expect(school.body.report.percent).toBe(90);
    expect(school.body.timetable.days[2].lessons[0].lesson.title).toBe(
      'Ангийн цаг',
    );

    // И-мэйлээр холбох: аль хэдийн Дорж-той → 409; салгаад Сүрэнд холбоно
    await api()
      .post(`/api/studexa/school/pupils/${pupil2}/link`)
      .set(auth(tokM))
      .send({ email: EMAIL_S })
      .expect(409);
    await api()
      .post(`/api/studexa/school/pupils/${pupil1}/unlink`)
      .set(auth(tokM))
      .expect(201);
    await api()
      .post(`/api/studexa/school/pupils/${pupil2}/link`)
      .set(auth(tokM))
      .send({ email: EMAIL_S })
      .expect(201);
    await api()
      .post(`/api/studexa/school/pupils/${pupil2}/link`)
      .set(auth(tokM))
      .send({ email: 'nobody@example.mn' })
      .expect(404);
    const school2 = await api()
      .get('/api/studexa/portal/school')
      .set(auth(tokS))
      .expect(200);
    expect(school2.body.pupil.name).toBe('Сүрэн');
    const stA = await api()
      .get('/api/studexa/students?group=10г&limit=100')
      .set(auth(tokA))
      .expect(200);
    expect(
      stA.body.items.find((s: { name: string }) => s.name === 'Сүрэн').userId,
    ).toBe(userS);
    expect(
      stA.body.items.find((s: { name: string }) => s.name === 'Дорж В').userId,
    ).toBeNull();
  });

  it('ангиас гаргах (LEFT бүх roster-т), бүрмөсөн устгах, багш хасах, анги устгах', async () => {
    await api()
      .post(`/api/studexa/school/pupils/${pupil2}/leave`)
      .set(auth(tokM))
      .expect(201);
    const def = await api()
      .get('/api/studexa/students?group=10г&limit=100')
      .set(auth(tokA))
      .expect(200);
    expect(
      def.body.items.some((s: { name: string }) => s.name === 'Сүрэн'),
    ).toBe(false);
    const left = await api()
      .get('/api/studexa/students?group=10г&status=LEFT')
      .set(auth(tokM))
      .expect(200);
    expect(left.body.items.map((s: { name: string }) => s.name)).toEqual([
      'Сүрэн',
    ]);
    // Устгах — зөвхөн удирдлага; roster хамт устана
    await api()
      .delete(`/api/studexa/school/pupils/${pupil2}`)
      .set(auth(tokM))
      .expect(403);
    await api()
      .delete(`/api/studexa/school/pupils/${pupil2}`)
      .set(auth(tokA))
      .expect(200);
    const all = await api()
      .get('/api/studexa/students?status=ALL&limit=100')
      .set(auth(tokA))
      .expect(200);
    expect(
      all.body.items.some((s: { name: string }) => s.name === 'Сүрэн'),
    ).toBe(false);
    // Багш хасах → А-гийн roster/түүх хэвээр
    await api()
      .delete(`/api/studexa/school/classes/${classId}/teachers/${teacherA}`)
      .set(auth(tokA))
      .expect(200);
    const st = await api()
      .get('/api/studexa/students?group=10г&limit=100')
      .set(auth(tokA))
      .expect(200);
    expect(st.body.total).toBe(3);
    const d = await api()
      .get(`/api/studexa/school/classes/${classId}`)
      .set(auth(tokA))
      .expect(200);
    expect(d.body.teachers).toHaveLength(1);
    // Анги устгах → мастер ангигүй (зөвхөн удирдлага харна), багшийн өгөгдөл хэвээр
    await api()
      .delete(`/api/studexa/school/classes/${classId}`)
      .set(auth(tokM))
      .expect(403);
    await api()
      .delete(`/api/studexa/school/classes/${classId}`)
      .set(auth(tokA))
      .expect(200);
    await api()
      .get(`/api/studexa/school/pupils/${pupil1}`)
      .set(auth(tokM))
      .expect(403);
    const pd = await api()
      .get(`/api/studexa/school/pupils/${pupil1}`)
      .set(auth(tokA))
      .expect(200);
    expect(pd.body.class).toBeNull();
    expect(pd.body.rosters).toHaveLength(2);
    const lm = await api()
      .get('/api/studexa/school/classes')
      .set(auth(tokM))
      .expect(200);
    expect(lm.body.items).toHaveLength(0);
  });
});
