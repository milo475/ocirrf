import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { JoinDto, PortalQueryDto, SubmitDto } from './dto/studexa.dto';
import { StudexaHomeworkService } from './homework.service';
import { StudexaPortalService } from './portal.service';
import {
  STUDEXA_MAX_FILE_BYTES,
  studexaFileFilter,
  studexaStorage,
} from './studexa-files';
import { contentDisposition } from './studexa.util';

/** STUDEXA — СУРАГЧИЙН ПОРТАЛ (studexa.portal эрх) */
@Controller('studexa/portal')
@RequirePermission(PERM.STUDEXA_PORTAL)
export class StudexaPortalController {
  constructor(
    private readonly portal: StudexaPortalService,
    private readonly homework: StudexaHomeworkService,
  ) {}

  @Get()
  portalData(@CurrentUser() user: AuthUser, @Query() q: PortalQueryDto) {
    return this.portal.portal(user, q.t);
  }

  @Get('school')
  school(@CurrentUser() user: AuthUser) {
    return this.portal.schoolInfo(user);
  }

  @Get('report-card')
  reportCard(
    @CurrentUser() user: AuthUser,
    @Query() q: PortalQueryDto,
    @Query('term') term?: string,
  ) {
    return this.portal.reportCard(user, q.t, term || undefined);
  }

  @Post('join')
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinDto) {
    return this.portal.join(user, dto.code);
  }

  @Post('leave/:recordId')
  leave(
    @CurrentUser() user: AuthUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    return this.portal.leave(user, recordId);
  }

  @Post('homework/:id/submit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: studexaStorage,
      limits: { fileSize: STUDEXA_MAX_FILE_BYTES },
      fileFilter: studexaFileFilter,
    }),
  )
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.homework.submit(user, id, dto, file);
  }

  @Get('schedule.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  async scheduleSvg(
    @CurrentUser() user: AuthUser,
    @Query() q: PortalQueryDto,
    @Res() res: Response,
  ) {
    const svg = await this.portal.scheduleSvg(user, q.t);
    res.setHeader('Content-Disposition', contentDisposition('huvaari.svg'));
    res.send(svg);
  }
}
