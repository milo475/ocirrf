import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthService } from './auth.service';
import { AllowTempPassword } from './decorators/allow-temp-password.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterOrgDto } from './dto/register-org.dto';
import type { Request } from 'express';

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
// Байгууллагын бүртгэл бүр DB-д мөр үүсгэдэг тул хамгийн хатуу лимит:
// нэг IP-ээс цагт 5 (бодит хэрэглээнд байгууллага нэг л удаа бүртгүүлнэ).
const REGISTER_ORG_LIMIT = Number.isFinite(ENV_LIMIT) ? ENV_LIMIT : 5;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    // IP нь амжилтгүй оролдлогын бүртгэлд ордог — довтолгоо нэг эх
    // сурвалжаас ирж буйг таних гол мэдээлэл (V5)
    return this.authService.login(
      dto,
      req.ip ?? null,
      req.get('user-agent') ?? null,
    );
  }

  /**
   * Байгууллагын нээлттэй бүртгэл (Multi-tenancy) — байгууллага +
   * эхний ADMIN нэг алхамд үүсээд шууд нэвтэрнэ.
   */
  @Public()
  @Post('register-org')
  @Throttle({ default: { limit: REGISTER_ORG_LIMIT, ttl: 3_600_000 } })
  registerOrg(@Body() dto: RegisterOrgDto) {
    return this.authService.registerOrganization(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
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
  @Throttle({ default: { limit: CHANGE_PASSWORD_LIMIT, ttl: 60_000 } })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  /**
   * Өөрийн нэвтрэлтийн түүх (V5).
   *
   * Эрх шаардахгүй — хэрэглэгч ӨӨРИЙНХӨӨ түүхийг л харна. «Миний
   * бүртгэлээр өөр хүн орсон уу» гэдгийг зөвхөн тухайн хүн таньж
   * чадна, тиймээс түүнд харуулах нь хамгийн үр дүнтэй.
   */
  @Get('login-history')
  loginHistory(@CurrentUser() user: AuthUser) {
    return this.authService.loginHistory(user.id);
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
