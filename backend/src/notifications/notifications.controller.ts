import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Observable, defer, switchMap } from 'rxjs';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import type { SseEvent } from './notifications.service';

class QueryNotificationsDto {
  @IsOptional()
  @IsBooleanString()
  unread?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/** Бүх route зөвхөн өөрийн мэдэгдэл дээр ажиллана — эрхийн шалгалт хэрэггүй */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * SSE stream (V4-09). EventSource header дэмждэггүй тул access token
   * query param-аар ирж энд гараар шалгагдана (@Public — global guard
   * header шаарддаг). Token хүчингүй бол stream алдаагаар хаагдаж
   * frontend хэсэг хугацааны дараа шинэ token-оор дахин холбогдоно.
   */
  @Public()
  @Sse('stream')
  stream(@Query('token') token: string): Observable<SseEvent> {
    return defer(async () => {
      let payload: JwtPayload;
      try {
        payload = await this.jwt.verifyAsync<JwtPayload>(token ?? '', {
          secret: process.env.JWT_SECRET,
        });
      } catch {
        throw new UnauthorizedException('Stream token хүчингүй');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true },
      });
      if (!user?.isActive) {
        throw new UnauthorizedException('Stream token хүчингүй');
      }
      return user.id;
    }).pipe(switchMap((userId) => this.notificationsService.subscribe(userId)));
  }

  @Get()
  list(@Query() query: QueryNotificationsDto, @CurrentUser() user: AuthUser) {
    return this.notificationsService.list(
      user.id,
      query.unread === 'true',
      query.page,
      query.limit,
    );
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch(':id/read')
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
