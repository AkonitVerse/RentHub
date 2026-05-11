import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientLinkingService } from '../src/modules/clients/client-linking.service';
import type { PrismaService } from '../src/common/prisma/prisma.service';

const makeMockPrisma = () => {
  let nextId = 1;
  const clients: any[] = [];

  const prisma: any = {
    client: {
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        const conditions: any[] = where.OR ?? [];
        const found = clients.find((c) =>
          conditions.some((cond) => {
            if (cond.phone) return c.phone === cond.phone;
            if (cond.email) return c.email === cond.email;
            return false;
          }),
        );
        return Promise.resolve(found ?? null);
      }),
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: any) =>
          Promise.resolve(
            clients.find((c) => (where.phone ? c.phone === where.phone : c.id === where.id)) ??
              null,
          ),
        ),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const c = { id: nextId++, ...data };
        clients.push(c);
        return Promise.resolve(c);
      }),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        const c = clients.find((x) => x.id === where.id);
        if (c) Object.assign(c, data);
        return Promise.resolve(c);
      }),
    },
    user: {
      findUnique: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve({
          id: where.id,
          email: 'u@test.local',
          name: 'Тестер',
          client: clients.find((c) => c.userId === where.id) ?? null,
        }),
      ),
    },
  };

  return { prisma, clients };
};

describe('ClientLinkingService', () => {
  let mock: ReturnType<typeof makeMockPrisma>;
  let service: ClientLinkingService;

  beforeEach(() => {
    mock = makeMockPrisma();
    service = new ClientLinkingService(mock.prisma as unknown as PrismaService);
  });

  const user = (id: number) => ({
    id,
    email: `u${id}@test.local`,
    name: 'User',
    role: 'USER' as const,
    passwordHash: 'h',
    refreshTokenHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('linkOrCreate', () => {
    it('создаёт нового клиента, если совпадений нет', async () => {
      const c = await service.linkOrCreate(user(10) as any, {
        name: 'Иван',
        phone: '+79111111111',
        email: 'ivan@test.local',
      });
      expect(c.userId).toBe(10);
      expect(c.phone).toBe('+79111111111');
      expect(mock.clients).toHaveLength(1);
    });

    it('линкует к существующему клиенту по телефону, если userId не занят', async () => {
      mock.clients.push({
        id: 1,
        name: 'Существ',
        phone: '+72222222222',
        email: null,
        userId: null,
      });
      const c = await service.linkOrCreate(user(20) as any, {
        name: 'Иван',
        phone: '+72222222222',
      });
      expect(c.id).toBe(1);
      expect(c.userId).toBe(20);
      expect(mock.clients).toHaveLength(1);
    });

    it('бросает 409, если телефон занят другим аккаунтом', async () => {
      mock.clients.push({ id: 1, name: 'Существ', phone: '+73333333333', email: null, userId: 99 });
      await expect(
        service.linkOrCreate(user(30) as any, { name: 'Иван', phone: '+73333333333' }),
      ).rejects.toThrow(/уже связан/);
    });

    it('возвращает уже связанного клиента, если userId совпадает', async () => {
      mock.clients.push({ id: 1, name: 'Я', phone: '+74444444444', email: null, userId: 40 });
      const c = await service.linkOrCreate(user(40) as any, { name: 'Я', phone: '+74444444444' });
      expect(c.id).toBe(1);
      expect(c.userId).toBe(40);
    });

    it('линкует по email, если телефон не совпал', async () => {
      mock.clients.push({
        id: 1,
        name: 'Анна',
        phone: '+71111110000',
        email: 'anna@test.local',
        userId: null,
      });
      const c = await service.linkOrCreate(user(50) as any, {
        name: 'Анна',
        phone: '+79999999999',
        email: 'anna@test.local',
      });
      expect(c.id).toBe(1);
      expect(c.userId).toBe(50);
    });
  });

  describe('resolveForCheckout', () => {
    it('возвращает связанного клиента для авторизованного юзера', async () => {
      mock.clients.push({ id: 1, name: 'Тест', phone: '+78888888888', userId: 60, email: null });
      const c = await service.resolveForCheckout(60, {
        name: 'игнор',
        phone: '+79999999999',
      });
      expect(c.id).toBe(1);
    });

    it('создаёт нового клиента для анонимного checkout', async () => {
      const c = await service.resolveForCheckout(undefined, {
        name: 'Аноним',
        phone: '+71112223344',
      });
      expect(c.userId).toBeUndefined();
      expect(mock.clients).toHaveLength(1);
    });

    it('переиспользует существующего клиента по телефону при анонимном checkout', async () => {
      mock.clients.push({ id: 1, name: 'Был', phone: '+72223334455', userId: null, email: null });
      const c = await service.resolveForCheckout(undefined, {
        name: 'Был',
        phone: '+72223334455',
      });
      expect(c.id).toBe(1);
      expect(mock.clients).toHaveLength(1);
    });
  });
});
