import { IsUUID } from 'class-validator';

export class AssignDriverDto {
  @IsUUID('4', { message: 'driverId буруу форматтай' })
  driverId: string;
}
