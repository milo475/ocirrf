import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PlatformService } from './platform.service';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  /** Нэвтрэлтгүй нүүр хуудасны app card-ууд */
  @Public()
  @Get('apps')
  apps() {
    return this.platformService.listPublicApps();
  }

  /** Нэвтэрсэн хэрэглэгчийн байгууллагын идэвхтэй app-ууд (launcher) */
  @Get('my-apps')
  myApps() {
    return this.platformService.myApps();
  }
}
