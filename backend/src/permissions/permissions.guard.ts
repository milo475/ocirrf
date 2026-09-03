import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import type { PermKey } from './permission-keys';
import { PermissionsService } from './permissions.service';
import {
  ANY_PERMISSION_KEY,
  PERMISSIONS_KEY,
} from './require-permission.decorator';

/**
 * Global guard — JwtAuthGuard, RolesGuard-ын ДАРАА ажиллана.
 * @RequirePermission заасан route дээр effective permission шалгана;
 * заагаагүй route-д оролцохгүй (аажим шилжилт — @Roles хэвээр үйлчилнэ).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<PermKey[]>(
      PERMISSIONS_KEY,
      targets,
    );
    const anyOf = this.reflector.getAllAndOverride<PermKey[]>(
      ANY_PERMISSION_KEY,
      targets,
    );
    const needsAll = required && required.length > 0;
    const needsAny = anyOf && anyOf.length > 0;
    if (!needsAll && !needsAny) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user) {
      return false;
    }

    const effective = await this.permissions.getEffectivePermissions(
      user.id,
      user.role,
    );
    if (needsAll && !required.every((key) => effective.has(key))) {
      return false;
    }
    if (needsAny && !anyOf.some((key) => effective.has(key))) {
      return false;
    }
    return true;
  }
}
