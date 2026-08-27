import { SetMetadata } from '@nestjs/common';

export const ALLOW_TEMP_PASSWORD_KEY = 'allowTempPassword';

/**
 * Түр нууц үгтэй (mustChangePassword) хэрэглэгчид энэ route нээлттэй —
 * change-password, me зэрэгт л хэрэглэнэ (V4-06).
 */
export const AllowTempPassword = () =>
  SetMetadata(ALLOW_TEMP_PASSWORD_KEY, true);
