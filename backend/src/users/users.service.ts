import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}

/** passwordHash-ыг хэзээ ч буцаахгүй */
const SAFE_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: SAFE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          username: dto.email, // email хэлбэрийн утга username талбарт
          fullName: dto.name,
          passwordHash,
          role: dto.role,
        },
        select: SAFE_SELECT,
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Ийм имэйлтэй хэрэглэгч бүртгэлтэй байна');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }

    if (id === currentUserId && dto.isActive === false) {
      throw new BadRequestException('Өөрийгөө идэвхгүй болгох боломжгүй');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.fullName = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_SELECT,
    });
  }
}
