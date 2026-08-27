import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthService } from './auth.service';
import { AllowTempPassword } from './decorators/allow-temp-password.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  /** V4-06: түр нууц үгээ солино — mustChangePassword үед ганц нээлттэй үйлдэл */
  @Post('change-password')
  @AllowTempPassword()
  @HttpCode(HttpStatus.OK)
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
