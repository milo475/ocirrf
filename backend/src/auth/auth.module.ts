import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  // Secret-үүдийг token бүрийн sign/verify дээр тусад нь өгдөг тул
  // JwtModule-ийг default тохиргоогүй бүртгэнэ.
  imports: [ActivityLogModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
