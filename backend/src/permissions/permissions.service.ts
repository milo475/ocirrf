import { Injectable } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALL_PERMISSIONS,
  PermKey,
  ROLE_DEFAULTS,
} from './permission-keys';

/** Cache-ийн нэг мөр: тооцсон permission олонлог + дуусах хугацаа */
type CacheEntry = { perms: Set<PermKey>; expires: number };

const CACHE_TTL_MS = 60_000;

@Injectable()
export class PermissionsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Effective permission = ROLE_DEFAULTS дээр UserPermission override
   * давхарласан олонлог. ADMIN үргэлж бүх түлхүүртэй — override үл
   * хэрэгсэнэ (хэн ч ADMIN-аас permission хасаж чадахгүй).
   * Хүсэлт бүрт DB уншихгүйн тулд 60 секундын in-memory cache-тэй.
   */
  async getEffectivePermissions(
    userId: string,
    role: Role,
  ): Promise<Set<PermKey>> {
    if (role === Role.ADMIN) {
      return new Set(ALL_PERMISSIONS);
    }

    const hit = this.cache.get(userId);
    if (hit && hit.expires > Date.now()) {
      return hit.perms;
    }

    const overrides = await this.prisma.userPermission.findMany({
      where: { userId },
    });
    const perms = new Set<PermKey>(ROLE_DEFAULTS[role] ?? []);
    for (const o of overrides) {
      if (o.allowed) {
        perms.add(o.permKey as PermKey);
      } else {
        perms.delete(o.permKey as PermKey);
      }
    }

    this.cache.set(userId, { perms, expires: Date.now() + CACHE_TTL_MS });
    return perms;
  }

  async has(userId: string, role: Role, key: PermKey): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId, role);
    return perms.has(key);
  }

  /** Override өөрчлөгдөхөд заавал дуудна — cache шинэчлэгдэнэ */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }
}
