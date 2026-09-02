import { Prisma } from '../generated/prisma/client';
import { orgAls } from '../org/org-context';

/**
 * ORG-SCOPE EXTENSION — байгууллагын өгөгдлийн тусгаарлалтын цөм.
 *
 * SCOPED model-ийн бүх query-д тухайн request-ийн байгууллагыг
 * автоматаар шүүлт болгож нэмнэ:
 *   - унших/засах/устгах: `where`-д `organizationId` (Prisma-ийн
 *     extended-where-unique тул findUnique({id}) ч хамрагдана —
 *     өөр байгууллагын id 404 болно)
 *   - create: `data`-д backfill + өөр org руу бичихийг хориглоно
 *
 * Context байхгүй бол FAIL CLOSED — алдаа шиднэ. Ингэснээр шүүлтээ
 * мартсан код чимээгүй бүх байгууллагын өгөгдөл буцаахын оронд чанга
 * унана.
 *
 * ХАМРАГДАХГҮЙ зүйлс (гараар org шүүлт хийх ёстой):
 *   - $queryRaw / $executeRaw — extension model query биш
 *   - nested create (одоогоор scoped model-ийн nested create байхгүй;
 *     нэмбэл NOT NULL багана чанга унагана)
 */

// organizationId ЗААВАЛ байх model-ууд. Шинэ model нэмэхдээ:
// (1) schema-д organizationId + relation, (2) энд нэрийг нь,
// (3) create call site-д explicit organizationId — гурвууланг нь.
export const SCOPED_MODELS: ReadonlySet<string> = new Set<string>([
  'User',
  'Company',
  'Category',
  'Product',
  'Order',
  'OrderRequest',
  'Supply',
  'DriverHandover',
  'Payment',
  'FinanceEntry',
  'DriverPayout',
  'StockMovement',
  'ProductBatch',
  'OrderReturn',
  'Setting',
]);

// organizationId нь nullable: нэвтрэлтийн ӨМНӨХ security event
// context-гүй бичигдэж болно (уншилт нь ердийнхөөрөө scoped).
export const OPTIONAL_SCOPED_MODELS: ReadonlySet<string> = new Set<string>([
  'ActivityLog',
]);

const WHERE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

type AnyArgs = Record<string, any>;

export const orgScopeExtension = Prisma.defineExtension({
  name: 'org-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const scoped = SCOPED_MODELS.has(model);
        const optional = OPTIONAL_SCOPED_MODELS.has(model);
        if (!scoped && !optional) return query(args);

        const store = orgAls.getStore();
        if (store?.bypass) return query(args);

        const orgId = store?.organizationId;
        if (!orgId) {
          // ActivityLog: нэвтрэлтийн өмнөх бичилт context-гүй зөвшөөрнө
          if (
            optional &&
            (operation === 'create' || operation === 'createMany')
          ) {
            return query(args);
          }
          throw new Error(
            `Байгууллагын context алга: ${model}.${operation} (fail closed)`,
          );
        }

        const a: AnyArgs = { ...(args as AnyArgs) };

        if (operation === 'create') {
          const data = (a.data ?? {}) as AnyArgs;
          if (data.organizationId && data.organizationId !== orgId) {
            throw new Error(`Өөр байгууллага руу бичихийг хориглоно: ${model}`);
          }
          a.data = { ...data, organizationId: orgId };
        } else if (
          operation === 'createMany' ||
          operation === 'createManyAndReturn'
        ) {
          const rows: AnyArgs[] = Array.isArray(a.data) ? a.data : [a.data];
          for (const row of rows) {
            if (row.organizationId && row.organizationId !== orgId) {
              throw new Error(
                `Өөр байгууллага руу бичихийг хориглоно: ${model}`,
              );
            }
          }
          a.data = rows.map((row) => ({ ...row, organizationId: orgId }));
        } else if (operation === 'upsert') {
          a.where = { ...a.where, organizationId: orgId };
          const create = (a.create ?? {}) as AnyArgs;
          if (create.organizationId && create.organizationId !== orgId) {
            throw new Error(`Өөр байгууллага руу бичихийг хориглоно: ${model}`);
          }
          a.create = { ...create, organizationId: orgId };
        } else if (WHERE_OPS.has(operation)) {
          a.where = { ...a.where, organizationId: orgId };
        }

        return query(a);
      },
    },
  },
});
