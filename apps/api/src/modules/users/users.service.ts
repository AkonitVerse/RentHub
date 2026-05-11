import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Список сотрудников платформы — только ADMIN и MANAGER. Клиенты (роль USER)
   * сюда не попадают: они управляются в разделе «Клиенты» вместе с историей заказов.
   */
  list() {
    return this.prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(dto: CreateUserDto) {
    // Нормализация email — `User@x.com` и `user@x.com` должны считаться одним.
    const normalizedEmail = dto.email.trim().toLowerCase();

    const emailTaken = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (emailTaken) throw new ConflictException('Пользователь с таким email уже существует');

    // Уникальность телефона по всей БД (admin + manager + клиенты).
    const phoneTaken = await this.prisma.user.findFirst({ where: { phone: dto.phone } });
    if (phoneTaken)
      throw new ConflictException('Пользователь с таким телефоном уже зарегистрирован');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    try {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          phone: dto.phone,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          name: fullName,
          passwordHash,
          role: dto.role,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return user;
    } catch (e) {
      // P2002: race на unique между check и create — отдаём 409, не 500.
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Email или телефон уже занят, попробуйте другой');
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdateUserDto, currentUserId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Пользователь ${id} не найден`);

    // Не даём админу понизить себе роль (защита от потери доступа)
    if (id === currentUserId && dto.role && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException('Нельзя изменить свою собственную роль');
    }

    // Защита: нельзя оставить платформу без единого администратора.
    // Если этот пользователь — ADMIN, и ему хотят сменить роль на не-ADMIN,
    // проверяем что он не единственный.
    if (user.role === UserRole.ADMIN && dto.role !== undefined && dto.role !== UserRole.ADMIN) {
      const otherAdminsCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN, id: { not: id } },
      });
      if (otherAdminsCount === 0) {
        throw new BadRequestException(
          'Нельзя понизить роль последнего администратора. Сначала назначьте другого.',
        );
      }
    }

    const data: Record<string, unknown> = {};
    const newFirstName = dto.firstName?.trim() ?? user.firstName;
    const newLastName = dto.lastName?.trim() ?? user.lastName;
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      data.name = `${newFirstName} ${newLastName}`;
    }
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new BadRequestException('Нельзя удалить собственный аккаунт');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Пользователь ${id} не найден`);

    // Защита: нельзя удалить последнего администратора. Без админа в системе
    // никто не сможет назначать новых админов и менять критичные настройки.
    if (user.role === UserRole.ADMIN) {
      const otherAdminsCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN, id: { not: id } },
      });
      if (otherAdminsCount === 0) {
        throw new BadRequestException(
          'Нельзя удалить последнего администратора. Сначала назначьте другого.',
        );
      }
    }

    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
