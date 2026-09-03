import { Prisma } from '../generated/prisma/client';
import { OrgContext } from '../org/org-context';

/**
 * Захиалгын мөрийг transaction дуустал түгжинэ (PostgreSQL `FOR UPDATE`).
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ (TOCTOU):
 * Төлбөр/буцаалтын логик нь захиалгыг уншиж, `paidAmount`-ыг тооцоод
 * шинэ утгыг БҮТНЭЭР нь бичдэг (increment биш — статус нь дүнгээс
 * хамаардаг тул). Хэрэв уншилт транзакцаас гадна эсвэл түгжээгүй бол
 * зэрэг ирсэн хоёр төлбөр хоёулаа ижил хуучин `paidAmount`-ыг уншиж,
 * хоёр дахь бичилт эхнийхийг ДАРЖ бичнэ → Payment мөр хоёулаа үлдээд
 * захиалгын paidAmount ганцыг л тусгана (мөнгө алдагдана).
 *
 * `FOR UPDATE` нь зэрэг орсон хоёр дахь транзакцийг эхнийх commit
 * хийтэл хүлээлгэж, дараа нь READ COMMITTED-ийн дагуу ШИНЭЧЛЭГДСЭН
 * мөрийг уншуулна. Түгжсэний дараа Prisma-гаар дахин уншсан утга
 * найдвартай (Decimal хөрвүүлэлт нь Prisma-гийнхаараа хэвээр).
 *
 * Зөвхөн `id`-г буцаана — raw хариунаас Decimal задлахгүй.
 * (`Order.id` нь schema-д `String @id @default(uuid())` — Postgres дээр
 * `uuid` БИШ `text` багана тул хөрвүүлэлт хийхгүй.)
 */
export async function lockOrderForUpdate(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<boolean> {
  // Raw SQL-д org-scope extension үйлчлэхгүй тул ГАРААР шүүнэ
  // (Multi-tenancy) — өөр байгууллагын захиалга «олдсонгүй» болно
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order"
    WHERE "id" = ${orderId} AND "organizationId" = ${OrgContext.require()}
    FOR UPDATE
  `;
  return rows.length > 0;
}

/**
 * `Supply` мөрийг түгжинэ — `SupplyService.pay` нь `paidAmount`-ыг уншаад
 * АБСОЛЮТ утгаар бичдэг тул түгжээгүй бол алдагдсан шинэчлэл (lost update)
 * үүсдэг: 100,000-ийн өрөнд хоёр ажилтан зэрэг 50,000 төлөхөд хоёулаа 0-г
 * уншиж, хоёулаа EXPENSE бичээд, хоёулаа `paidAmount = 50,000` гэж бичнэ.
 * Мөнгө 100,000 гарсан ч өр 50,000 хэвээр үлдэнэ.
 *
 * `lockOrderForUpdate`-тэй ижил дүрэм: raw SQL-д org-scope extension
 * үйлчлэхгүй тул `organizationId`-г ГАРААР шүүнэ.
 */
export async function lockSupplyForUpdate(
  tx: Prisma.TransactionClient,
  supplyId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Supply"
    WHERE "id" = ${supplyId} AND "organizationId" = ${OrgContext.require()}
    FOR UPDATE
  `;
  return rows.length > 0;
}
