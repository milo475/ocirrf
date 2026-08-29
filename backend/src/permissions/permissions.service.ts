import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALL_PERMISSIONS,
  PERM,
  PERM_GROUPS,
  PERM_LABELS,
  PermKey,
  ROLE_DEFAULTS,
} from './permission-keys';

export type PermissionChange = { key: PermKey; allowed?: boolean | null };

/**
 * Cache-ийн нэг мөр: тооцсон permission олонлог + дуусах хугацаа.
 * `role`-ыг хамт хадгална: түлхүүр нь userId боловч УТГА нь role-оос
 * хамаардаг тул эрх солигдоход хуучин мөрийг ашиглаж болохгүй.
 */
type CacheEntry = { role: Role; perms: Set<PermKey>; expires: number };

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

    // role таарахгүй бол cache-ийг үл тоомсорлоно — UsersService.update
    // invalidate дуудахаас гадна энэ нь хоёр дахь хамгаалалтын давхарга
    const hit = this.cache.get(userId);
    if (hit && hit.role === role && hit.expires > Date.now()) {
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

    this.cache.set(userId, {
      role,
      perms,
      expires: Date.now() + CACHE_TTL_MS,
    });
    return perms;
  }

  async has(userId: string, role: Role, key: PermKey): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId, role);
    return perms.has(key);
  }

  /** Override ЭСВЭЛ role өөрчлөгдөхөд заавал дуудна — cache шинэчлэгдэнэ */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /** Permission Panel: бүлэглэсэн бүтэц (role default + override + effective) */
  async getPanel(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }

    const isAdmin = user.role === Role.ADMIN;
    const defaults = new Set(ROLE_DEFAULTS[user.role] ?? []);
    const overrides = await this.prisma.userPermission.findMany({
      where: { userId },
    });
    const ovMap = new Map(overrides.map((o) => [o.permKey, o.allowed]));

    return {
      role: user.role,
      name: user.fullName,
      groups: PERM_GROUPS.map((g) => ({
        group: g.group,
        items: g.keys.map((key) => {
          // ADMIN үргэлж бүгд ✅ — override харуулахгүй, үл хэрэгсэнэ
          const roleDefault = isAdmin ? true : defaults.has(key);
          const override = isAdmin ? null : (ovMap.get(key) ?? null);
          return {
            key,
            label: PERM_LABELS[key],
            roleDefault,
            override,
            effective: isAdmin ? true : (override ?? roleDefault),
          };
        }),
      })),
    };
  }

  /**
   * Override-уудыг transaction-аар хэрэгжүүлнэ.
   * allowed=null (эсвэл орхисон) → override устгаж default руу буцаана.
   */
  async applyChanges(
    actor: AuthUser,
    targetId: string,
    changes: PermissionChange[],
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }
    if (target.role === Role.ADMIN) {
      throw new BadRequestException('Админы эрхийг хязгаарлах боломжгүй');
    }

    // Өөрийнхөө permissions.manage-ийг хасаж түгжирэхээс хамгаална
    if (actor.id === targetId) {
      const defaults = new Set(ROLE_DEFAULTS[target.role] ?? []);
      for (const c of changes) {
        if (c.key !== PERM.PERMISSIONS_MANAGE) continue;
        const wouldHave = c.allowed ?? defaults.has(PERM.PERMISSIONS_MANAGE);
        if (!wouldHave) {
          throw new BadRequestException(
            'Өөрийнхөө эрхийн тохиргооны эрхийг хасах боломжгүй',
          );
        }
      }
    }

    await this.prisma.$transaction(
      changes.map((c) =>
        c.allowed === null || c.allowed === undefined
          ? this.prisma.userPermission.deleteMany({
              where: { userId: targetId, permKey: c.key },
            })
          : this.prisma.userPermission.upsert({
              where: {
                userId_permKey: { userId: targetId, permKey: c.key },
              },
              create: { userId: targetId, permKey: c.key, allowed: c.allowed },
              update: { allowed: c.allowed },
            }),
      ),
    );

    this.invalidate(targetId);
    for (const c of changes) {
      this.logChange(actor.id, targetId, c.key, c.allowed ?? null);
    }
    return this.getPanel(targetId);
  }

  /** Permission өөрчлөлт бүр ActivityLog-д бичигдэнэ (fire-and-forget) */
  private logChange(
    actorId: string,
    targetId: string,
    permKey: PermKey,
    allowed: boolean | null,
  ): void {
    void this.prisma.activityLog
      .create({
        data: {
          userId: actorId,
          action: 'permission_change',
          entity: 'permissions',
          entityId: targetId,
          meta: { permKey, allowed },
        },
      })
      .catch(() => {});
  }
}
