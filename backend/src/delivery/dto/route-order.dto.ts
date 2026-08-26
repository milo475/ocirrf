import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class RouteOrderDto {
  @IsUUID('4', { message: 'driverId буруу форматтай' })
  driverId: string;

  /** Хүргэх дарааллаараа — orderIds[i] нь routeOrder i+1 болно */
  @IsArray()
  @ArrayNotEmpty({ message: 'orderIds хоосон байж болохгүй' })
  @IsUUID('4', { each: true, message: 'orderIds буруу форматтай' })
  orderIds: string[];
}
