import { SetMetadata } from '@nestjs/common';
import type { PermKey } from './permission-keys';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSION_KEY = 'permissions:any';

/**
 * Route-д шаардлагатай permission-ийг заана:
 *   @RequirePermission(PERM.ORDERS_CREATE)
 * Хэд хэдэн түлхүүр өгвөл БҮГД байх шаардлагатай.
 * Заагаагүй route-д PermissionsGuard оролцохгүй — @Roles логик хэвээр.
 *
 * АНХААР: Reflector.getAllAndOverride нь handler-ийн метаданныг класс-ынхтай
 * НИЙЛҮҮЛДЭГГҮЙ, СОЛЬДОГ. Класс дээр @RequirePermission байгаа route-ын
 * handler дээр дахин бичих бол класс-ын түлхүүрийг МӨН давтан бичнэ.
 */
export const RequirePermission = (...keys: PermKey[]) =>
  SetMetadata(PERMISSIONS_KEY, keys);

/**
 * Жагсаасан түлхүүрүүдийн АЛЬ НЭГ нь байхад хангалттай:
 *   @RequireAnyPermission(PERM.DRIVERS_VIEW, PERM.ORDERS_ASSIGN_DRIVER)
 * Нэг өгөгдлийг хэд хэдэн ажлын урсгал хэрэглэдэг үед (ж: жолоочийн
 * жагсаалтыг "жолооч харах" ба "жолооч хуваарилах" хоёулаа уншина).
 */
export const RequireAnyPermission = (...keys: PermKey[]) =>
  SetMetadata(ANY_PERMISSION_KEY, keys);
