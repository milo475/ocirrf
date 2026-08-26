import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import type { PermKey } from './permission-keys';
import { PermissionsService } from './permissions.service';
import { PERMISSIONS_KEY } from './require-permission.decorator';

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
    const required = this.reflector.getAllAndOverride<PermKey[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();
    if (!user) {
      return false;
    }

    const effective = await this.permissions.getEffectivePermissions(
      user.id,
      user.role,
    );
    return required.every((key) => effective.has(key));
  }
}
