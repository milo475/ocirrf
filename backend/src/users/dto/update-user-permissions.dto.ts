import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ALL_PERMISSIONS } from '../../permissions/permission-keys';
import type { PermKey } from '../../permissions/permission-keys';

export class PermissionChangeDto {
  @IsIn(ALL_PERMISSIONS, { message: 'Буруу permission түлхүүр' })
  key!: PermKey;

  /** true/false = override; null эсвэл орхивол override устгаж default руу буцаана */
  @IsOptional()
  @IsBoolean({ message: 'allowed нь boolean эсвэл null байна' })
  allowed?: boolean | null;
}

export class UpdateUserPermissionsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'changes хоосон байж болохгүй' })
  @ValidateNested({ each: true })
  @Type(() => PermissionChangeDto)
  changes!: PermissionChangeDto[];
}
