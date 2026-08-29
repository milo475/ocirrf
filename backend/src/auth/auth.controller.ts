import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthService } from './auth.service';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
import { AllowTempPassword } from './decorators/allow-temp-password.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

// Rate limit (V4-07): IP тутамд login 5/мин.
// Тест орчинд AUTH_RATE_LIMIT env-ээр өндөр лимит тавьдаг.
const ENV_LIMIT = parseInt(process.env.AUTH_RATE_LIMIT ?? '', 10);
const LOGIN_LIMIT = Number.isFinite(ENV_LIMIT) ? ENV_LIMIT : 5;
// change-password нь ХУУЧИН нууц үгийг хязгааргүй таах суваг байсан —
// login-тэй ижил хатуу лимиттэй болголоо.
const CHANGE_PASSWORD_LIMIT = Number.isFinite(ENV_LIMIT) ? ENV_LIMIT : 5;
// refresh нь хэвийн ажиллагаанд 15 минутад нэг л удаа дуудагддаг тул
// 20/мин нь бодит хэрэглээнд саад болохгүй, харин token brute-force-ыг хаана.
const REFRESH_LIMIT = Number.isFinite(ENV_LIMIT) ? ENV_LIMIT : 20;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }


  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: REFRESH_LIMIT, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  /** V4-08: гарахад refresh token revoke хийгдэнэ */
  @Post('logout')
  @AllowTempPassword()
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  /** V4-06: түр нууц үгээ солино — mustChangePassword үед ганц нээлттэй үйлдэл */
  @Post('change-password')
  @AllowTempPassword()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: CHANGE_PASSWORD_LIMIT, ttl: 60_000 } })
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser) {
    return this.authService.changePassword(user.id, dto);
  }

  @Get('me')
  @AllowTempPassword()
  async me(@CurrentUser() user: AuthUser) {
    // Frontend permissions массиваар товч/цэс нуух шийдвэрээ гаргана
    const permissions = await this.permissionsService.getEffectivePermissions(
      user.id,
      user.role,
    );
    return { ...user, permissions: [...permissions] };
  }
}
