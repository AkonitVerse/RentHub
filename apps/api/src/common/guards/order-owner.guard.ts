import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from '../decorators/current-user.decorator';

/**
 * Допускает доступ только если запрашиваемый order принадлежит
 * клиенту, привязанному к текущему пользователю. Используется
 * на эндпойнтах /me/orders/:id*.
 */
@Injectable()
export class OrderOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtUserPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Необходима авторизация');

    const idParam = req.params['id'];
    const orderId = Number(idParam);
    if (!Number.isInteger(orderId)) {
      throw new NotFoundException('Заказ не найден');
    }

    const client = await this.prisma.client.findUnique({ where: { userId: user.sub } });
    if (!client) throw new ForbiddenException('У аккаунта нет привязанного клиента');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, clientId: true },
    });
    if (!order) throw new NotFoundException(`Заказ #${orderId} не найден`);
    if (order.clientId !== client.id) {
      throw new ForbiddenException('Доступ к заказу запрещён');
    }

    return true;
  }
}
