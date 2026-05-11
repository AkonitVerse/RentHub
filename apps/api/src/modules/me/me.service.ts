import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/me.dto';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  /** Профиль текущего пользователя + связанный клиент. */
  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    const { passwordHash: _ph, refreshTokenHash: _rt, ...safe } = user;
    return safe;
  }

  /** Список заказов привязанного клиента. Если клиента нет — пустой массив. */
  async listOrders(userId: number, filter?: { status?: OrderStatus }) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) return { items: [], total: 0 };

    const where: Prisma.OrderWhereInput = { clientId: client.id };
    if (filter?.status) where.status = filter.status;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: {
              equipment: { select: { id: true, name: true, sku: true, photos: true } },
            },
          },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total };
  }

  /** Деталь заказа. Гард уже проверил владение. */
  async getOrder(orderId: number) {
    return this.orders.getById(orderId);
  }

  /**
   * Обновление профиля пользователя. Email и телефон уникальны.
   * Изменения телефона/имени пробрасываем в Client (если он привязан).
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    // Нормализация email (trim + lowerCase) — иначе `User@x.com` и `user@x.com`
    // считаются разными при unique-проверке Postgres.
    const normalizedEmail = dto.email ? dto.email.trim().toLowerCase() : undefined;

    if (normalizedEmail && normalizedEmail !== user.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email: normalizedEmail, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) throw new ConflictException('Email уже используется другим пользователем');
    }
    if (dto.phone && dto.phone !== user.phone) {
      const takenByUser = await this.prisma.user.findFirst({
        where: { phone: dto.phone, NOT: { id: userId } },
        select: { id: true },
      });
      if (takenByUser) throw new ConflictException('Телефон уже используется другим аккаунтом');

      // Также проверяем коллизию с manual-клиентом без привязанного user.
      const takenByClient = await this.prisma.client.findFirst({
        where: {
          phone: dto.phone,
          ...(user.client ? { NOT: { id: user.client.id } } : {}),
          userId: null,
        },
        select: { id: true },
      });
      if (takenByClient)
        throw new ConflictException('Телефон уже привязан к карточке другого клиента');
    }

    return this.prisma.$transaction(async (tx) => {
      // Если меняется имя или фамилия — пересчитываем denormalized name.
      const newFirstName = dto.firstName?.trim() ?? user.firstName;
      const newLastName = dto.lastName?.trim() ?? user.lastName;
      const newFullName = `${newFirstName} ${newLastName}`;
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName ? dto.firstName.trim() : undefined,
          lastName: dto.lastName ? dto.lastName.trim() : undefined,
          name: dto.firstName || dto.lastName ? newFullName : undefined,
          email: normalizedEmail ?? undefined,
          phone: dto.phone ?? undefined,
        },
        include: { client: true },
      });

      // Синхронизируем поля Client-карточки, если она привязана,
      // чтобы менеджер видел актуальные данные клиента.
      if (updatedUser.client) {
        await tx.client.update({
          where: { id: updatedUser.client.id },
          data: {
            name: dto.firstName || dto.lastName ? newFullName : undefined,
            phone: dto.phone ?? undefined,
            email: normalizedEmail ?? undefined,
          },
        });
      }

      const refreshed = await tx.user.findUnique({
        where: { id: userId },
        include: { client: true },
      });
      const { passwordHash: _ph, refreshTokenHash: _rt, ...safe } = refreshed!;
      return safe;
    });
  }

  /**
   * Смена пароля. Требуется верный текущий пароль.
   * После смены инвалидируем refreshTokenHash, чтобы все активные сессии
   * (на других устройствах) были разорваны.
   */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Неверный текущий пароль');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshTokenHash: null },
    });
    return { ok: true };
  }

  /**
   * Отмена заказа клиентом — допустима только для DRAFT/PENDING.
   * Прочие статусы — приходить в магазин и говорить с менеджером.
   */
  async cancelOrder(orderId: number, userId: number) {
    const order = await this.orders.getById(orderId);
    const allowedForCancel: OrderStatus[] = [OrderStatus.DRAFT, OrderStatus.PENDING];
    if (!allowedForCancel.includes(order.status)) {
      throw new ForbiddenException(
        'Отмена возможна только для черновика или заказа, ожидающего подтверждения. Свяжитесь с менеджером.',
      );
    }
    return this.orders.changeStatus(
      orderId,
      { status: OrderStatus.CANCELLED, note: 'Отменено клиентом из личного кабинета' },
      userId,
    );
  }
}
