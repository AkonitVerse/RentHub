import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Client, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ContactSnapshot {
  name: string;
  phone: string;
  email?: string | null;
}

@Injectable()
export class ClientLinkingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Связывает аккаунт User с карточкой Client. Если Client есть по
   * телефону или email — линкует. Если занят другим юзером — 409.
   * Если не найден — создаёт нового и сразу линкует.
   *
   * Используется при регистрации.
   */
  async linkOrCreate(user: User, contact: ContactSnapshot): Promise<Client> {
    const found = await this.prisma.client.findFirst({
      where: {
        OR: [{ phone: contact.phone }, contact.email ? { email: contact.email } : { id: -1 }],
      },
    });

    if (found) {
      if (found.userId && found.userId !== user.id) {
        throw new ConflictException(
          `Контакт уже связан с другим аккаунтом. Войдите в существующий аккаунт или используйте другой номер телефона.`,
        );
      }
      if (!found.userId) {
        return this.prisma.client.update({
          where: { id: found.id },
          data: {
            userId: user.id,
            name: found.name || contact.name,
            email: found.email ?? contact.email ?? null,
          },
        });
      }
      return found;
    }

    return this.prisma.client.create({
      data: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email ?? null,
        userId: user.id,
      },
    });
  }

  /**
   * Возвращает Client для checkout-операции:
   * - если userId передан и у юзера есть привязанный Client — отдаёт его;
   * - если userId есть, но Client не привязан — линкует/создаёт через данные формы;
   * - если userId нет (анонимный checkout) — ищет по телефону, иначе создаёт.
   */
  async resolveForCheckout(
    userId: number | undefined,
    contact: ContactSnapshot,
    tx?: Prisma.TransactionClient,
  ): Promise<Client> {
    const db = tx ?? this.prisma;

    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { client: true },
      });
      if (user?.client) return user.client;
      if (user) return this.linkOrCreate(user, contact);
    }

    const existing = await db.client.findUnique({ where: { phone: contact.phone } });
    if (existing) return existing;

    if (!contact.name || !contact.phone) {
      throw new BadRequestException('Для нового клиента обязательны имя и телефон');
    }
    return db.client.create({
      data: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email ?? null,
      },
    });
  }
}
