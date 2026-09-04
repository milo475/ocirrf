import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Global — auth (нууц үг сэргээх) болон дурын app и-мэйл илгээхэд */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
