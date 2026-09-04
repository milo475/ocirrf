import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import {
  ClassDto,
  ClassTeacherDto,
  LinkPupilDto,
  PupilDto,
} from './dto/studexa.dto';
import { StudexaSchoolService } from './school.service';

/**
 * STUDEXA — НЭГДСЭН АНГИ (сургуулийн түвшин). Уншихад studexa.teach хангалттай
 * (өөрийн ангиа), өөрчлөхөд studexa.manage эсвэл ангийн багш (service шалгана).
 */
@Controller('studexa/school')
@RequirePermission(PERM.STUDEXA_TEACH)
export class StudexaSchoolController {
  constructor(private readonly school: StudexaSchoolService) {}

  @Get('classes')
  list(@CurrentUser() user: AuthUser) {
    return this.school.listClasses(user);
  }

  @Post('classes')
  create(@CurrentUser() user: AuthUser, @Body() dto: ClassDto) {
    return this.school.createClass(user, dto);
  }

  @Get('teachers')
  teachers(@CurrentUser() user: AuthUser) {
    return this.school.orgTeachers(user);
  }

  @Get('classes/:id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.school.classDetail(user, id);
  }

  @Patch('classes/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassDto,
  ) {
    return this.school.updateClass(user, id, dto);
  }

  @Delete('classes/:id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.school.deleteClass(user, id);
  }

  @Post('classes/:id/teachers')
  addTeacher(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassTeacherDto,
  ) {
    return this.school.addTeacher(user, id, dto);
  }

  @Delete('classes/:id/teachers/:teacherId')
  removeTeacher(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ) {
    return this.school.removeTeacher(user, id, teacherId);
  }

  @Post('classes/:id/pupils')
  addPupil(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PupilDto,
  ) {
    return this.school.addPupil(user, id, dto);
  }

  @Post('classes/:id/pupils/import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  importPupils(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('CSV файл хавсаргана уу');
    return this.school.importPupils(user, id, file.buffer);
  }

  @Get('pupils/:id')
  pupil(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.school.pupilDetail(user, id);
  }

  @Patch('pupils/:id')
  updatePupil(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PupilDto,
  ) {
    return this.school.updatePupil(user, id, dto);
  }

  @Post('pupils/:id/leave')
  leave(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.school.leavePupil(user, id);
  }

  @Delete('pupils/:id')
  deletePupil(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.school.deletePupil(user, id);
  }

  @Post('pupils/:id/link')
  link(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkPupilDto,
  ) {
    return this.school.linkPupil(user, id, dto);
  }

  @Post('pupils/:id/unlink')
  unlink(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.school.unlinkPupil(user, id);
  }
}
