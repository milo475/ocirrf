import { Transform, Type } from 'class-transformer';

/** Query-гийн хоосон утга ('') → undefined: @IsOptional үүнийг алгасдаг тул */
const EmptyToUndefined = () =>
  Transform(({ value }) => (value === '' ? undefined : (value as unknown)));
import {
  registerDecorator,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  StudexaAttendanceStatus,
  StudexaGender,
  StudexaHomeworkStatus,
  StudexaMonthPayState,
  StudexaPayState,
  StudexaSchoolType,
  StudexaStudentStatus,
} from '../../generated/prisma/client';

import { isValidDateStr } from '../studexa.util';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_MSG = 'Огноо YYYY-MM-DD хэлбэртэй, хуанлид байгаа огноо байна';

/** Бодит огноо (YYYY-MM-DD ба хуанлид байгаа) — @Matches-ээс хатуу */
function IsDateStr() {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isDateStr',
      target: object.constructor,
      propertyName,
      options: { message: DATE_MSG },
      validator: { validate: (v: unknown) => isValidDateStr(v) },
    });
}

// ───────────────────────────── Багшийн профайл

export class SetupTeacherDto {
  @IsEnum(StudexaSchoolType, { message: 'Сургуулийн төрөл буруу' })
  schoolType: StudexaSchoolType;

  /** Их сургуулийн багш өөрийн кодоо оруулна; бусдад систем олгоно */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,30}$/, {
    message: 'Код 3–30 тэмдэгт: үсэг, тоо, . _ - зөвшөөрнө',
  })
  code?: string;
}

export class UpdateTeacherDto {
  @IsOptional()
  @IsEnum(StudexaSchoolType, { message: 'Сургуулийн төрөл буруу' })
  schoolType?: StudexaSchoolType;
}

// ───────────────────────────── Сурагч

export class StudentDto {
  @IsString()
  @MinLength(1, { message: 'Нэр хоосон байж болохгүй' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  group?: string;

  @IsOptional()
  @IsEnum(StudexaPayState)
  paymentStatus?: StudexaPayState;

  @IsOptional()
  @IsString()
  @IsDateStr()
  enrolled?: string;

  @IsOptional() @IsString() @MaxLength(30) studentCode?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) fatherName?: string;
  @IsOptional() @IsString() @MaxLength(20) fatherPhone?: string;
  @IsOptional() @IsString() @MaxLength(100) motherName?: string;
  @IsOptional() @IsString() @MaxLength(20) motherPhone?: string;
  // Сургуулийн профайл
  @IsOptional() @IsString() @MaxLength(30) registerNo?: string;
  @EmptyToUndefined() @IsOptional() @IsString() @IsDateStr() birthDate?: string;
  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(StudexaGender)
  gender?: StudexaGender;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsEnum(StudexaStudentStatus) status?: StudexaStudentStatus;
}

export class QueryStudentsDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  /** '__none__' — бүлэггүй сурагчид */
  @IsOptional() @IsString() @MaxLength(100) group?: string;
  @EmptyToUndefined()
  @IsOptional()
  @IsEnum(StudexaPayState)
  payment?: StudexaPayState;
  /** ACTIVE (default) | GRADUATED | LEFT | ALL */
  @EmptyToUndefined()
  @IsOptional()
  @IsIn(['ACTIVE', 'GRADUATED', 'LEFT', 'ALL'])
  status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number =
    20;
}

export class GroupNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class GroupAddDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  studentIds: string[];
}

export class PaymentSetDto {
  /** Он — өгөхгүй бол энэ он */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsEnum(StudexaMonthPayState)
  status: StudexaMonthPayState;
}

export class AssessmentAddDto {
  @IsOptional() @IsUUID('4') columnId?: string;
  @IsOptional() @IsString() @MaxLength(100) newColumnName?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  newColumnMax?: number;

  @IsString()
  @IsDateStr()
  date: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  score: number;
}

export class JoinApproveDto {
  /** 'new' — шинэ сурагч болгож нэмэх; UUID — байгаа сурагчтай холбох */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  studentId?: string;
}

// ───────────────────────────── Ирц

export class AttendanceQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @IsDateStr()
  date?: string;
  @EmptyToUndefined() @IsOptional() @IsUUID('4') lessonId?: string;
  @IsOptional() @IsString() @MaxLength(100) group?: string;
}

export class AttendanceSaveDto extends AttendanceQueryDto {
  /** { studentId: 'PRESENT' | 'LATE' | 'ABSENT' } */
  @IsObject()
  statuses: Record<string, StudexaAttendanceStatus>;
  /** Хичээлийн сэдэв (журнал) — хичээл сонгосон үед */
  @IsOptional() @IsString() @MaxLength(500) topic?: string;
}

// ───────────────────────────── Дүнгийн нэгтгэл

export class GradeCellDto {
  @IsUUID('4') columnId: string;
  @IsUUID('4') studentId: string;
  /** '' — оноог устгана */
  @IsOptional() @IsString() @MaxLength(10) value?: string;
}

export class GradeColumnEditDto {
  @IsUUID('4') id: string;
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;
  /** '' — хичээлгүй болгоно; undefined — өөрчлөхгүй */
  @IsOptional() @IsString() @MaxLength(40) subjectId?: string;
  @IsOptional() @IsString() @MaxLength(40) termId?: string;
}

export class GradeStudentValueDto {
  @IsUUID('4') studentId: string;
  /** '' — автомат руу буцаана */
  @IsOptional() @IsString() @MaxLength(10) value?: string;
}

export class GradebookSaveDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => GradeCellDto)
  cells?: GradeCellDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GradeColumnEditDto)
  columns?: GradeColumnEditDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => GradeStudentValueDto)
  attendance?: GradeStudentValueDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => GradeStudentValueDto)
  hwPercent?: GradeStudentValueDto[];
}

export class ColumnCreateDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;
  @EmptyToUndefined() @IsOptional() @IsUUID('4') subjectId?: string;
  @EmptyToUndefined() @IsOptional() @IsUUID('4') termId?: string;
}

// ───────────────────────────── Хичээл, улирал, үнэлгээ (сургуулийн нэмэлт)

export class SubjectDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsIn(['indigo', 'green', 'purple']) color?: string;
}

export class TermDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsString() @IsDateStr() startDate: string;
  @IsString() @IsDateStr() endDate: string;
}

export class GradingStepDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) min: number;
  @IsString() @MinLength(1) @MaxLength(8) label: string;
}

export class GradingScaleDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GradingStepDto)
  scale: GradingStepDto[];
}

export class StudentNoteDto {
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}

// ───────────────────────────── Хуваарь

export class LessonDto {
  @IsString() @MinLength(1) @MaxLength(100) title: string;
  @IsOptional() @IsString() @MaxLength(100) group?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(6) weekday: number;
  @IsString()
  @Matches(TIME, { message: 'Цаг HH:MM хэлбэртэй байна' })
  startTime: string;
  @IsString()
  @Matches(TIME, { message: 'Цаг HH:MM хэлбэртэй байна' })
  endTime: string;
  @IsOptional() @IsIn(['indigo', 'green', 'purple']) color?: string;
  /** Хичээл (судлагдахуун) — '' бол хоосон */
  @IsOptional() @IsString() @MaxLength(40) subjectId?: string;
}

// ───────────────────────────── Даалгавар

export class HomeworkCreateDto {
  /** 'all' | 'group:<нэр>' | сурагчийн UUID */
  @IsString() @MaxLength(120) target: string;
  @IsString() @IsDateStr() date: string;
  @IsString() @IsDateStr() dueDate: string;
  @IsString() @MinLength(1) @MaxLength(4000) title: string;
  @IsOptional() @IsString() @MaxLength(500) link?: string;
}

export class HomeworkQueryDto {
  @IsOptional()
  @IsIn(['', 'open', 'PENDING', 'IN_PROGRESS', 'DONE'])
  status?: string;
  @IsOptional() @IsString() @MaxLength(100) group?: string;
}

export class HomeworkStatusDto {
  @IsEnum(StudexaHomeworkStatus) status: StudexaHomeworkStatus;
}

export class HomeworkGradeDto {
  /** '' эсвэл null — оноог хоослоно */
  @IsOptional() @IsString() @MaxLength(10) score?: string;
  @IsOptional() @IsString() @MaxLength(10) maxScore?: string;
}

export class SubmitDto {
  @IsOptional() @IsString() @MaxLength(500) link?: string;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

// ───────────────────────────── Зарлал, тэмдэглэл

export class AnnouncementDto {
  @IsString() @MinLength(1) @MaxLength(4000) text: string;
  @IsOptional() @IsString() @MaxLength(100) group?: string;
}

export class NoteDto {
  @IsString() @MinLength(1) @MaxLength(100) title: string;
  @IsString() @MinLength(1) @MaxLength(4000) text: string;
}

// ───────────────────────────── Портал

export class JoinDto {
  @IsString() @MinLength(3) @MaxLength(30) code: string;
}

export class PortalQueryDto {
  @EmptyToUndefined()
  @IsOptional()
  @IsUUID('4')
  t?: string;
}

/** Сурагчийн нээлттэй бүртгэл — багшийн кодоор тухайн байгууллагад */
export class RegisterStudentDto {
  @IsString() @MinLength(3) @MaxLength(30) teacherCode: string;
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  @MaxLength(254)
  email: string;
  @IsString()
  @MinLength(6, { message: 'Нууц үг хамгийн багадаа 6 тэмдэгт' })
  @MaxLength(128)
  password: string;
  @IsString() @MinLength(1) @MaxLength(100) firstName: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsEnum(StudexaSchoolType) schoolType?: StudexaSchoolType;
  @IsOptional() @IsString() @MaxLength(30) studentCode?: string;
  @IsOptional() @IsString() @MaxLength(100) fatherName?: string;
  @IsOptional() @IsString() @MaxLength(20) fatherPhone?: string;
  @IsOptional() @IsString() @MaxLength(100) motherName?: string;
  @IsOptional() @IsString() @MaxLength(20) motherPhone?: string;
}

export class BoolFlagDto {
  @IsOptional() @IsBoolean() flag?: boolean;
}
