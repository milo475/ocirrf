import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/** Global — guard болон дурын модуль PermissionsService-ийг шууд авна */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
