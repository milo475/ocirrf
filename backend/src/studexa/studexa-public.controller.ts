import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RegisterStudentDto } from './dto/studexa.dto';
import { StudexaPortalService } from './portal.service';
import { StudexaTeacherService } from './teacher.service';

/**
 * STUDEXA — эрхийн шаардлагагүй endpoint-ууд: нэвтэрсэн хэрэглэгчийн
 * «me» (нүүр хуудас шийднэ) ба сурагчийн НЭЭЛТТЭЙ бүртгэл (нэвтрэлтгүй).
 * Тусдаа controller: класс түвшний @RequirePermission-той controller-т
 * @Public route байвал PermissionsGuard хэрэглэгчгүй тул унагадаг.
 */
@Controller('studexa')
export class StudexaPublicController {
  constructor(
    private readonly teachers: StudexaTeacherService,
    private readonly portal: StudexaPortalService,
  ) {}

  /** Нэвтэрсэн хэрэглэгчийн Studexa дахь байр суурь */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.teachers.me(user);
  }

  /** Бүртгэлийн формд багшийн кодыг урьдчилан шалгах */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('teacher-code/:code')
  checkCode(@Param('code') code: string) {
    return this.portal.checkCode(code);
  }

  /** Сурагч багшийн кодоор өөрөө бүртгүүлнэ (register-org-той ижил хязгаар) */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('register-student')
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.portal.registerStudent(dto);
  }
}
