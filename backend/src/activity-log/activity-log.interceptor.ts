import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
/** Эдгээр үг агуулсан талбарууд meta-д ОРОХГҮЙ */
const SENSITIVE = ['password', 'token', 'secret'];

function sanitize(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  try {
    const plain = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
    for (const key of Object.keys(plain)) {
      if (SENSITIVE.some((s) => key.toLowerCase().includes(s))) {
        delete plain[key];
      }
    }
    return Object.keys(plain).length > 0 ? plain : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Амжилттай POST/PATCH/PUT/DELETE бүрийг ActivityLog-д бичнэ
 * (auth-аас бусад). Бичилт fire-and-forget — хүсэлтийг удаашруулахгүй,
 * алдаа гарвал хүсэлтэд нөлөөлөхгүй.
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      user?: AuthUser;
      route?: { path?: string };
      params?: Record<string, string>;
      body?: unknown;
    }>();

    const routePath = req.route?.path ?? req.url;
    if (
      !req.user ||
      !MUTATING.has(req.method) ||
      routePath.includes('/auth/')
    ) {
      return next.handle();
    }

    const entity = context
      .getClass()
      .name.replace(/Controller$/, '')
      .toLowerCase();
    const params = req.params ?? {};
    const entityId = params.id ?? params.orderId ?? null;
    const action = `${req.method} ${routePath}`;
    const meta = sanitize(req.body);
    const userId = req.user.id;

    return next.handle().pipe(
      tap(() => {
        void this.prisma.activityLog
          .create({
            data: {
              userId,
              action,
              entity,
              entityId,
              meta: meta as Prisma.InputJsonValue | undefined,
            },
          })
          .catch(() => {});
      }),
    );
  }
}
