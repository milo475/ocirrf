import { SetMetadata } from '@nestjs/common';
import type { PermKey } from './permission-keys';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Route-д шаардлагатай permission-ийг заана:
 *   @RequirePermission(PERM.ORDERS_CREATE)
 * Хэд хэдэн түлхүүр өгвөл БҮГД байх шаардлагатай.
 * Заагаагүй route-д PermissionsGuard оролцохгүй — @Roles логик хэвээр.
 */
export const RequirePermission = (...keys: PermKey[]) =>
  SetMetadata(PERMISSIONS_KEY, keys);
