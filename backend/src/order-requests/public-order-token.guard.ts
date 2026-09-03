import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * НИЙТИЙН ЗАХИАЛГЫН TOKEN-ИЙГ ФАЙЛ ХҮЛЭЭН АВАХААС ӨМНӨ ШАЛГАНА.
 *
 * Guard нь interceptor (multer) -оос өмнө ажилладаг. Ингэснээр
 * хүчингүй эсвэл түдгэлзсэн байгууллагын token-той хүсэлт файлаа
 * дискэнд бичихээс өмнө 404 авна. Байгууллагын context-ийг энд
 * тавихгүй — service-ийн resolveOrg хэвээр хийнэ (нэг эх сурвалж).
 *
 * Organization нь org-scoped биш тул context-гүй уншиж болно.
 */
@Injectable()
export class PublicOrderTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ query?: { token?: unknown } }>();
    const token = req.query?.token;
    if (typeof token !== 'string' || token.length === 0 || token.length > 200) {
      throw new NotFoundException('Линк хүчингүй байна');
    }
    const org = await this.prisma.organization.findUnique({
      where: { publicOrderToken: token },
      select: { isActive: true },
    });
    if (!org || !org.isActive) {
      throw new NotFoundException('Линк хүчингүй байна');
    }
    return true;
  }
}
