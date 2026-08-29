import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AssignDriverDto {
  @IsUUID('4', { message: 'driverId буруу форматтай' })
  driverId: string;
}

/** Олон захиалгад нэг жолоочийг зэрэг хуваарилах (V5) */
export class BulkAssignDriverDto {
  @IsUUID('4', { message: 'driverId буруу форматтай' })
  driverId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 захиалга сонгоно' })
  @IsUUID('4', { each: true, message: 'orderId буруу форматтай' })
  orderIds: string[];
}

/** Дүүргээр автоматаар хуваарилах (V5) — жолоочийг систем сонгоно */
export class AutoAssignDriverDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 захиалга сонгоно' })
  @IsUUID('4', { each: true, message: 'orderId буруу форматтай' })
  orderIds: string[];
}
