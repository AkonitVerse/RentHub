import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateClientDto, ListClientsDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListClientsDto) {
    const where: Prisma.ClientWhereInput = {};
    if (query.clientType) {
      where.clientType = query.clientType;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { inn: { contains: query.search } },
      ];
    }
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getById(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          include: { lines: { include: { equipment: true } } },
        },
      },
    });
    if (!client) throw new NotFoundException(`Клиент ${id} не найден`);

    const totalSpent = client.orders
      .filter((o) => o.status === 'DONE' || o.status === 'ACTIVE')
      .reduce((s, o) => s + o.totalAmount, 0);

    return { ...client, totalSpent };
  }

  create(dto: CreateClientDto) {
    return this.prisma.client.create({ data: dto });
  }

  async update(id: number, dto: UpdateClientDto) {
    const existing = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, userId: true, phone: true, email: true, clientType: true },
    });
    if (!existing) throw new NotFoundException(`Клиент ${id} не найден`);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({ where: { id }, data: dto });

      // Если у клиента привязан User-аккаунт — синхронизируем поля профиля
      // (телефон/email/имя), чтобы пользователь видел в ЛК актуальные данные.
      // User.email NOT NULL — сбрасывать в null нельзя; user.phone — может.
      // Для COMPANY: name — это название организации, не ФИО, поэтому не синхронизируем.
      if (existing.userId) {
        const isCompany =
          (dto.clientType ?? existing.clientType) === 'COMPANY';
        const userPatch: { phone?: string | null; email?: string; name?: string } = {};
        if (dto.phone && dto.phone !== existing.phone) userPatch.phone = dto.phone;
        if (dto.email && dto.email !== existing.email) userPatch.email = dto.email;
        if (dto.name && !isCompany) userPatch.name = dto.name;

        if (Object.keys(userPatch).length > 0) {
          await tx.user.update({
            where: { id: existing.userId },
            data: userPatch,
          });
        }
      }

      return updated;
    });
  }

  /**
   * Удаление клиента из админки.
   *
   * Логика двухуровневая, чтобы:
   *  - email/телефон удалённого клиента сразу освобождался для повторной
   *    регистрации (раньше старый User-аккаунт оставался жить и блокировал);
   *  - история заказов сохранялась как «следы взаимодействия с платформой»
   *    даже после удаления — при новой регистрации с тем же телефоном
   *    `clientLinking` найдёт осиротевшую карточку и подвяжет к новому
   *    аккаунту, заказы вернутся в ЛК автоматически.
   *
   * Поэтому:
   *  1. Если у клиента привязан User-аккаунт — удаляем User. Поле
   *     Client.userId автоматически становится NULL по `onDelete: SetNull`.
   *  2. Если у клиента НЕТ заказов — удаляем и саму карточку (мусор в БД
   *     не нужен). Если ЕСТЬ заказы — карточка остаётся как историческая
   *     запись с userId=NULL.
   */
  async remove(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
        user: { select: { id: true } },
      },
    });
    if (!client) throw new NotFoundException(`Клиент ${id} не найден`);

    if (client.user) {
      // Удалит refreshTokens, passwordResetCodes и т.п. каскадом.
      // Client.userId автоматом обнуляется (SetNull).
      await this.prisma.user.delete({ where: { id: client.user.id } });
    }

    if (client._count.orders === 0) {
      await this.prisma.client.delete({ where: { id } });
    }

    return { ok: true };
  }

  private async ensureExists(id: number): Promise<void> {
    const exists = await this.prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Клиент ${id} не найден`);
  }
}
