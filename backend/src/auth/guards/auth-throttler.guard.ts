import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

/** Auth route-уудын rate limit — 429-ийн мессежийг монголоор (V4-07) */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('Хэт олон оролдлого — түр хүлээнэ үү');
  }
}
