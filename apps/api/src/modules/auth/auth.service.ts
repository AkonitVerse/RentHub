import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { RefreshPayload } from './strategies/jwt-refresh.strategy';
import { ClientLinkingService } from '../clients/client-linking.service';
import { NotificationDispatcher } from '../notifications/notification-dispatcher.service';

const RESET_CODE_TTL_MIN = 15;
const RESET_RATE_LIMIT_SEC = 60;
const RESET_MAX_ATTEMPTS = 5;
const VERIFICATION_CODE_TTL_MIN = 15;
const VERIFICATION_RESEND_RATE_LIMIT_SEC = 60;
const VERIFICATION_MAX_ATTEMPTS = 5;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterContact {
  phone: string;
}

/**
 * Результат регистрации: либо подтверждение требуется (отправлен код на email),
 * либо сразу выдан User+JWT (для legacy/служебных кейсов — сейчас не используется
 * в публичном flow, оставлен на будущее, например для импорта аккаунтов).
 */
export type RegisterResult =
  | { requiresVerification: true; email: string }
  | { requiresVerification: false; user: User; tokens: AuthTokens };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly clientLinking: ClientLinkingService,
    private readonly notifications: NotificationDispatcher,
  ) {}

  /** Канонизация email: trim + lowerCase. В Postgres `email` чувствителен к регистру,
   *  поэтому без нормализации `User@x.com` и `user@x.com` — два разных аккаунта.
   *  Применяется везде где email — input от пользователя. */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Включена ли email-верификация (зависит от наличия SMTP-настроек).
   * - true → регистрация и сброс пароля идут через 6-значный код на email.
   * - false → "режим без кодов": регистрация сразу создаёт User+JWT,
   *   сброс пароля идёт сразу на форму нового пароля без ввода кода.
   *
   * Источник правды — единственная строка в OrgSettings (см. админку →
   * Настройки → Уведомления → SMTP). Логика синхронна с
   * OrgSettingsService.isEmailVerificationEnabled().
   */
  async isEmailVerificationEnabled(): Promise<boolean> {
    const row = await this.prisma.orgSettings.findUnique({
      where: { id: 1 },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true },
    });
    return Boolean(row?.smtpHost && row?.smtpPort && row?.smtpUser && row?.smtpPass);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const normalized = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user) {
      // Anti-enumeration: даже когда юзер не найден, тратим время на bcrypt,
      // чтобы не выдать наличие email через timing-attack.
      await bcrypt.compare(
        password,
        '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu',
      );
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Неверный email или пароль');
    return user;
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.validateUser(email, password);
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  /**
   * Регистрация. НЕ создаёт User в БД — данные сохраняются во временную
   * таблицу `pending_registrations` (ttl 15 мин). На email пользователя
   * отправляется 6-значный код. Реальный User создаётся в `verifyEmail()`
   * после подтверждения кода.
   *
   * Логика:
   *  1. Проверить что email/phone не заняты в `users` (verified юзеры).
   *  2. Проверить что email/phone не совпадают с публичными контактами
   *     организации (защита от захвата контактов из подвала сайта).
   *  3. Очистить истёкший pending для этого email/phone (если есть).
   *  4. Upsert pending: если активный pending для этого email/phone уже есть —
   *     заменяем его (обновляем все данные + новый код). Это покрывает
   *     сценарий «юзер ввёл данные, потом понял что ошибся, регается заново».
   *  5. Сгенерировать 6-значный код, hash, отправить на email.
   *  6. Вернуть {requiresVerification: true, email} — фронт ведёт на /verify-email.
   */
  async register(
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    contact: RegisterContact,
  ): Promise<RegisterResult> {
    const normalizedEmail = this.normalizeEmail(email);

    // 1. Конфликт с существующими (подтверждёнными) юзерами.
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new ConflictException('Пользователь с таким email уже существует');

    const phoneTaken = await this.prisma.user.findFirst({ where: { phone: contact.phone } });
    if (phoneTaken)
      throw new ConflictException('Пользователь с таким телефоном уже зарегистрирован');

    // 2. Защита публичных контактов организации.
    const orgSettings = await this.prisma.orgSettings.findUnique({
      where: { id: 1 },
      select: {
        orgEmail: true,
        orgPhone: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
      },
    });
    if (orgSettings) {
      const orgEmail = orgSettings.orgEmail.trim().toLowerCase();
      if (orgEmail && orgEmail === normalizedEmail) {
        throw new ConflictException(
          'Этот email используется как контактный email организации. Укажите свой личный email.',
        );
      }
      if (orgSettings.orgPhone && orgSettings.orgPhone === contact.phone) {
        throw new ConflictException(
          'Этот номер используется как контактный телефон организации. Укажите свой личный номер.',
        );
      }
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const fullName = `${trimmedFirstName} ${trimmedLastName}`;
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. Если email-верификация ОТКЛЮЧЕНА (SMTP не настроен) — создаём User
    //    напрямую без шага с кодом. Удобный режим для разработки и demo.
    const verificationEnabled = Boolean(
      orgSettings?.smtpHost &&
      orgSettings?.smtpPort &&
      orgSettings?.smtpUser &&
      orgSettings?.smtpPass,
    );

    if (!verificationEnabled) {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          phone: contact.phone,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          name: fullName,
          passwordHash,
          role: UserRole.USER,
        },
      });
      await this.clientLinking.linkOrCreate(user, {
        name: fullName,
        phone: contact.phone,
        email: normalizedEmail,
      });
      const tokens = await this.issueTokens(user);
      return { requiresVerification: false, user, tokens };
    }

    // 4. Email-верификация ВКЛЮЧЕНА — идём по полному flow с pending+кодом.
    // Ленивая очистка истёкших pending — освобождаем email/phone
    // если предыдущий pending не был подтверждён в срок.
    await this.prisma.pendingRegistration.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MIN * 60 * 1000);

    // 5. Upsert pending — атомарно по email и по phone.
    // Сначала удаляем любой активный pending с тем же email или phone,
    // потом создаём новый. Это покрывает все edge-cases (повтор регистрации,
    // ошибка email, и т.п.) — пользователь начинает с чистого листа.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.pendingRegistration.deleteMany({
          where: { OR: [{ email: normalizedEmail }, { phone: contact.phone }] },
        });
        await tx.pendingRegistration.create({
          data: {
            email: normalizedEmail,
            phone: contact.phone,
            passwordHash,
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            codeHash,
            expiresAt,
          },
        });
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Этот email или телефон уже зарегистрирован, попробуйте другой',
        );
      }
      throw e;
    }

    // 6. Отправить код на email.
    this.notifications.dispatch({
      type: 'EMAIL_VERIFICATION_CODE',
      audience: 'CLIENT',
      clientEmail: normalizedEmail,
      clientName: fullName,
      code,
      ttlMinutes: VERIFICATION_CODE_TTL_MIN,
    });

    return { requiresVerification: true, email: normalizedEmail };
  }

  /**
   * Подтверждение email кодом. Атомарная транзакция:
   *  1. Найти pending по email.
   *  2. Проверить срок и attempts.
   *  3. Сравнить код. Не совпало → attempts++, при достижении лимита pending
   *     удаляется (юзеру придётся регаться заново).
   *  4. Совпало → создать User, удалить pending, link Client, выдать JWT.
   */
  async verifyEmail(email: string, code: string): Promise<{ user: User; tokens: AuthTokens }> {
    const normalizedEmail = this.normalizeEmail(email);
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email: normalizedEmail },
    });
    // Pending не найден — отдаём 410 Gone, фронт редиректит на /login.
    if (!pending) {
      throw new HttpException(
        'Регистрация не найдена или устарела. Пройдите регистрацию заново.',
        HttpStatus.GONE,
      );
    }

    // Срок истёк — то же самое: 410 Gone, удалить pending, фронт редиректит.
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });
      throw new HttpException(
        'Срок действия кода истёк. Пройдите регистрацию заново.',
        HttpStatus.GONE,
      );
    }

    const matches = await bcrypt.compare(code, pending.codeHash);
    if (!matches) {
      const newAttempts = pending.attempts + 1;
      if (newAttempts >= VERIFICATION_MAX_ATTEMPTS) {
        // Лимит попыток исчерпан — 410 Gone. Pending удаляется, фронт
        // редиректит на /login. Сообщение нейтральное (без числа попыток).
        await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });
        throw new HttpException(
          'Слишком много неверных попыток. Пройдите регистрацию заново.',
          HttpStatus.GONE,
        );
      }
      await this.prisma.pendingRegistration.update({
        where: { id: pending.id },
        data: { attempts: newAttempts },
      });
      // Намеренно НЕ раскрываем сколько попыток осталось — это antipattern
      // безопасности (даёт информацию атакующему о длительности атаки).
      throw new BadRequestException('Неверный код');
    }

    // Код верный — создаём User и удаляем pending атомарно.
    const fullName = `${pending.firstName} ${pending.lastName}`;
    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: pending.email,
            firstName: pending.firstName,
            lastName: pending.lastName,
            name: fullName,
            phone: pending.phone,
            passwordHash: pending.passwordHash,
            role: UserRole.USER,
          },
        });
        await tx.pendingRegistration.delete({ where: { id: pending.id } });
        return created;
      });
    } catch (e) {
      // P2002: между verify и create someone уже занял email/phone.
      // Pending всё равно остаётся — пусть юзер попробует ещё раз.
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Этот email или телефон уже занят. Попробуйте зарегистрироваться заново.',
        );
      }
      throw e;
    }

    // Привязываем к Client (если он уже был, например из старого заказа по телефону).
    await this.clientLinking.linkOrCreate(user, {
      name: fullName,
      phone: pending.phone,
      email: pending.email,
    });

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  /**
   * Повторная отправка кода подтверждения.
   *
   * Поведение:
   *  - Pending не найден или истёк → 410 Gone (фронт редиректит на /login).
   *  - Rate-limit (60 сек после последнего выпуска) → 429 Too Many Requests
   *    с retryAfter в body. Фронт показывает «подождите N сек» и обновляет
   *    таймер. (Тихое игнорирование вводило юзера в заблуждение.)
   *  - Успех → новый код, обнуление attempts, отправка email.
   */
  async resendVerification(email: string): Promise<{ ok: true }> {
    const normalizedEmail = this.normalizeEmail(email);
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email: normalizedEmail },
    });
    if (!pending) {
      throw new HttpException(
        'Регистрация не найдена. Пройдите регистрацию заново.',
        HttpStatus.GONE,
      );
    }
    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });
      throw new HttpException(
        'Срок действия регистрации истёк. Пройдите регистрацию заново.',
        HttpStatus.GONE,
      );
    }

    // Rate-limit: 1 код в минуту. expiresAt обновляется при каждом resend
    // (становится now + 15 мин), поэтому время последнего выпуска кода =
    // expiresAt - 15 минут.
    const lastIssuedAt = new Date(
      pending.expiresAt.getTime() - VERIFICATION_CODE_TTL_MIN * 60 * 1000,
    );
    const sinceLastSec = Math.floor((Date.now() - lastIssuedAt.getTime()) / 1000);
    if (sinceLastSec < VERIFICATION_RESEND_RATE_LIMIT_SEC) {
      const retryAfter = VERIFICATION_RESEND_RATE_LIMIT_SEC - sinceLastSec;
      throw new HttpException(
        {
          message: `Подождите ещё ${retryAfter} сек, прежде чем отправить новый код.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const newCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const newCodeHash = await bcrypt.hash(newCode, 10);
    const newExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MIN * 60 * 1000);

    await this.prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        codeHash: newCodeHash,
        expiresAt: newExpiresAt,
        attempts: 0, // сбрасываем счётчик неверных попыток
      },
    });

    this.notifications.dispatch({
      type: 'EMAIL_VERIFICATION_CODE',
      audience: 'CLIENT',
      clientEmail: pending.email,
      clientName: `${pending.firstName} ${pending.lastName}`,
      code: newCode,
      ttlMinutes: VERIFICATION_CODE_TTL_MIN,
    });

    return { ok: true };
  }

  async refresh(payload: RefreshPayload, oldToken: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Сессия недействительна');
    }
    const matches = await bcrypt.compare(oldToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Сессия отозвана');
    }
    return this.issueTokens(user);
  }

  async logout(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async me(userId: number): Promise<Omit<User, 'passwordHash' | 'refreshTokenHash'>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const { passwordHash: _ph, refreshTokenHash: _rt, ...safe } = user;
    return safe;
  }

  /**
   * Запросить код восстановления пароля. Намеренно не раскрываем,
   * существует ли пользователь — всегда отвечаем `ok`.
   * Внутри: rate-limit (1 код в минуту), генерация 6-значного кода,
   * хэширование, отправка через NotificationDispatcher.
   */
  async forgotPassword(email: string): Promise<void> {
    // ВАЖНО: проверка SMTP идёт ПЕРВОЙ, до запроса в БД. Если email-верификация
    // отключена — отказываемся обслуживать восстановление пароля целиком,
    // даже через прямой curl/Postman. Без этого backend в bypass-режиме был
    // бы открытой дырой: атакующий через POST мог бы дёрнуть resetPassword
    // и сменить пароль любому юзеру по известному email.
    // Фронт это уже не вызывает (редирект на /login), но API защищаем тоже.
    if (!(await this.isEmailVerificationEnabled())) {
      throw new HttpException(
        'Восстановление пароля недоступно — Email верификация отключена',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
    if (!user) return; // тихо, защита от user enumeration

    const recent = await this.prisma.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - RESET_RATE_LIMIT_SEC * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      // не раскрываем причину — просто молча выходим
      return;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MIN * 60 * 1000);

    // Аннулируем все предыдущие активные коды юзера ПЕРЕД созданием нового —
    // чтобы attempts считались относительно ровно одного актуального кода и
    // юзер не мог обойти лимит, накопив несколько одновременно валидных кодов.
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      }),
      this.prisma.passwordResetCode.create({
        data: { userId: user.id, codeHash, expiresAt },
      }),
    ]);

    this.notifications.dispatch({
      type: 'PASSWORD_RESET_CODE',
      audience: 'CLIENT',
      clientEmail: user.email,
      clientName: user.name,
      code,
      ttlMinutes: RESET_CODE_TTL_MIN,
    });
  }

  /**
   * Проверка корректности и валидности кода без сброса пароля.
   * Используется UI на шаге "введите код" перед формой нового пароля.
   *
   * Семантика ошибок:
   *  - 410 Gone — код просрочен / исчерпаны попытки / не найден активный код.
   *    Это терминал — юзеру нужно заново запрашивать код через /forgot-password.
   *  - 400 Bad Request — код просто неверный, попытки ещё остались.
   */
  async verifyResetCode(email: string, code: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
    // Анти-enumeration: обращаемся одинаково и для существующего, и для
    // несуществующего email. Сообщение и статус как при истёкшем pending —
    // юзер либо ошибся в email, либо код реально истёк, на UX это одинаково.
    if (!user) {
      throw new HttpException(
        'Запрос устарел или код неверен. Запросите новый код.',
        HttpStatus.GONE,
      );
    }
    await this.consumeResetCode(user.id, code);
    return { ok: true };
  }

  /**
   * Сбрасывает пароль по коду. Транзакция:
   * - помечаем код used=true,
   * - меняем passwordHash, обнуляем refreshTokenHash.
   *
   * Те же правила ошибок что в verifyResetCode (410 / 400).
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<{ ok: true }> {
    // ВАЖНО: SMTP-проверка ПЕРВОЙ — раньше тут был bypass-режим, который
    // позволял сменить пароль любому юзеру по известному email без кода.
    // Это была уязвимость уровня account takeover. Теперь backend отбивает
    // запрос с 503 и фронту, и любому атакующему через curl.
    if (!(await this.isEmailVerificationEnabled())) {
      throw new HttpException(
        'Восстановление пароля недоступно — Email верификация отключена',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
    if (!user) {
      throw new HttpException(
        'Запрос устарел или код неверен. Запросите новый код.',
        HttpStatus.GONE,
      );
    }

    const valid = await this.consumeResetCode(user.id, code);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.update({
        where: { id: valid.id },
        data: { used: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, refreshTokenHash: null },
      }),
    ]);
    return { ok: true };
  }

  /**
   * Универсальная проверка кода сброса для verifyResetCode и resetPassword:
   *  1) Берёт самый свежий активный (не used, не expired) код юзера.
   *  2) bcrypt.compare с введённым:
   *     - match → возвращает запись;
   *     - mismatch → инкремент attempts. Если достигли RESET_MAX_ATTEMPTS —
   *       помечает код used=true и кидает 410 Gone (юзер должен заново
   *       запрашивать код). Иначе кидает 400 BadRequest "Неверный код".
   *  3) Если активного кода нет — 410 Gone (срок истёк или код уже использован).
   *
   * Поскольку forgotPassword инвалидирует прежние коды при создании нового,
   * в БД на момент вызова есть максимум один активный код на юзера.
   */
  private async consumeResetCode(
    userId: number,
    code: string,
  ): Promise<{ id: number; codeHash: string; attempts: number }> {
    const candidate = await this.prisma.passwordResetCode.findFirst({
      where: { userId, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!candidate) {
      // Нет активного кода — либо истёк срок, либо юзер не запрашивал, либо
      // уже исчерпал попытки. Со стороны юзера всё это решается одним
      // действием: запросить новый код.
      throw new HttpException(
        'Срок действия кода истёк или код не найден. Запросите новый код.',
        HttpStatus.GONE,
      );
    }

    const matches = await bcrypt.compare(code, candidate.codeHash);
    if (matches) return candidate;

    const newAttempts = candidate.attempts + 1;
    if (newAttempts >= RESET_MAX_ATTEMPTS) {
      // Исчерпан лимит попыток — гасим код, юзер должен запросить новый.
      await this.prisma.passwordResetCode.update({
        where: { id: candidate.id },
        data: { used: true, attempts: newAttempts },
      });
      throw new HttpException(
        'Слишком много неверных попыток. Запросите новый код.',
        HttpStatus.GONE,
      );
    }

    await this.prisma.passwordResetCode.update({
      where: { id: candidate.id },
      data: { attempts: newAttempts },
    });
    // НЕ раскрываем сколько попыток осталось — security best practice.
    throw new BadRequestException('Неверный код');
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessPayload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };
    const refreshPayload: RefreshPayload = {
      sub: user.id,
      email: user.email,
      jti: randomUUID(),
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: Number(this.config.get<number>('JWT_ACCESS_TTL', 900)),
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: Number(this.config.get<number>('JWT_REFRESH_TTL', 604_800)),
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }
}
