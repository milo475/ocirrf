import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/** Global — orders/delivery/stock зэрэг олон service дуудна */
@Global()
@Module({
  // JwtModule — SSE stream-ийн query token-ыг шалгахад (V4-09)
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
