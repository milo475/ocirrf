import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * БАЙГУУЛЛАГЫН (TENANT) CONTEXT.
 *
 * Request бүр AppModule.configure-ийн middleware-ээр хоосон store-той
 * эхэлнэ. `JwtStrategy.validate` (нэвтэрсэн хэрэглэгч) эсвэл public
 * token resolver (захиалгын нээлттэй линк) `organizationId`-г бөглөнө.
 * Үүний дараах бүх Prisma query org-scope extension-ээр тухайн
 * байгууллагад автоматаар хязгаарлагдана.
 *
 * Store огт байхгүй (request-ийн гадуур: скрипт, тест fixture) эсвэл
 * organizationId бөглөгдөөгүй үед scoped model-д хандвал extension
 * FAIL CLOSED — алдаа шиднэ. Санаатай тойрч гарах ганц зам нь
 * `runBypassed` бөгөөд grep-ээр бүх хэрэглээг нь олж аудит хийж болно.
 */
export interface OrgStore {
  organizationId?: string;
  /** true үед extension юу ч шүүхгүй — ЗӨВХӨН auth bootstrap-д */
  bypass?: boolean;
}

export const orgAls = new AsyncLocalStorage<OrgStore>();

export const OrgContext = {
  /** Middleware-ийн үүсгэсэн store-д байгууллагыг онооно. */
  set(organizationId: string): void {
    const store = orgAls.getStore();
    if (!store) {
      throw new Error(
        'Org store алга — request context-ийн гадуур OrgContext.set дуудагдав',
      );
    }
    store.organizationId = organizationId;
  },

  get(): string | undefined {
    return orgAls.getStore()?.organizationId;
  },

  /** Байгууллага заавал тодорхой байх газарт (create г.м.) ашиглана. */
  require(): string {
    const id = orgAls.getStore()?.organizationId;
    if (!id) {
      throw new Error('Байгууллагын context алга (fail closed)');
    }
    return id;
  },

  /**
   * Scope-гүй ажиллана. ЗӨВХӨН auth bootstrap (login, refresh,
   * JwtStrategy-ийн хэрэглэгч уншилт, uploads guard-ийн эзэмшил
   * шалгалт) хэрэглэнэ — шинэ хэрэглээ бүр код review-д тайлбар
   * шаардана.
   *
   * `await fn()` нь ЗААВАЛ run() ДОТОР: PrismaPromise нь lazy тул
   * гадаа await хийвэл query нь context-гүй орчинд ажиллаж
   * extension буруу store уншина.
   */
  runBypassed<T>(fn: () => Promise<T>): Promise<T> {
    return orgAls.run({ bypass: true }, async () => await fn());
  },

  /**
   * Тодорхой байгууллагын нэрийн өмнөөс ажиллана: register-org
   * transaction, public-token endpoint, тест fixture, ирээдүйн cron.
   */
  runWith<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
    return orgAls.run({ organizationId }, async () => await fn());
  },
};
