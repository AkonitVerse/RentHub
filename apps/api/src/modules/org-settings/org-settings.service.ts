import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { OrgSettings } from '@prisma/client';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SecretCipherService } from '../../common/crypto/secret-cipher';
import { SchedulerService } from '../scheduler/scheduler.service';
import { EmailNotificationProvider } from '../notifications/providers/email.provider';
import { UpdateOrgSettingsDto } from './dto/org-settings.dto';

@Injectable()
export class OrgSettingsService {
  private readonly logger = new Logger('OrgSettings');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
    @Inject(forwardRef(() => SchedulerService))
    private readonly scheduler: SchedulerService,
    private readonly emailProvider: EmailNotificationProvider,
  ) {}

  /**
   * При запросе наружу скрываем secret-поля. Пароль SMTP не должен утекать в /api/org-settings.
   * Возвращаем индикатор «есть пароль / нет», чтобы в админке показать звёздочки/плейсхолдер.
   */
  async getPublic(): Promise<Omit<OrgSettings, 'smtpPass'> & { smtpPassConfigured: boolean }> {
    const row = await this.get();
    const { smtpPass, ...safe } = row;
    return { ...safe, smtpPassConfigured: !!smtpPass };
  }

  /**
   * Публичные контактные реквизиты — без SMTP, без расписания cron.
   * Эндпоинт доступен анонимно: используется витриной (footer / страница «Контакты»).
   *
   * Дополнительно отдаём `emailVerificationEnabled` — фронт по нему решает,
   * показывать ли шаги с кодами подтверждения и кнопку "Забыли пароль?".
   * Флаг = true ⇔ все 4 SMTP-поля заполнены (см. isEmailVerificationEnabled).
   */
  async getContact(): Promise<{
    orgName: string;
    orgShortName: string;
    orgPhone: string;
    orgEmail: string;
    orgAddress: string;
    orgHours: string;
    logoPath: string | null;
    emailVerificationEnabled: boolean;
  }> {
    const row = await this.get();
    return {
      orgName: row.orgName,
      orgShortName: row.orgShortName,
      orgPhone: row.orgPhone,
      orgEmail: row.orgEmail,
      orgAddress: row.orgAddress,
      orgHours: row.orgHours,
      logoPath: row.logoPath,
      emailVerificationEnabled: this.isEmailVerificationEnabled(row),
    };
  }

  /**
   * Контент страницы «Условия аренды» для витрины.
   * Публичный эндпоинт — доступен анонимно.
   */
  async getRentalTerms(): Promise<{ title: string; content: string }> {
    const row = await this.get();
    return { title: row.rentalTermsTitle, content: row.rentalTermsContent };
  }

  /**
   * Включена ли email-верификация для регистрации и сброса пароля.
   * Условие: все 4 SMTP-поля (host, port, user, pass) заполнены и сохранены.
   * Если хоть одного нет — режим "без кодов" (для тестов и dev).
   *
   * Метод чистый, без побочек — можно вызвать из любого места без лишних
   * запросов в БД (передай уже загруженный OrgSettings).
   */
  isEmailVerificationEnabled(row: OrgSettings): boolean {
    return Boolean(row.smtpHost && row.smtpPort && row.smtpUser && row.smtpPass);
  }

  /** Singleton-строка id=1. Создана миграцией. */
  async get(): Promise<OrgSettings> {
    let row = await this.prisma.orgSettings.findUnique({ where: { id: 1 } });
    if (!row) {
      // На случай если миграция не сработала (например, dev-сценарий)
      row = await this.prisma.orgSettings.create({ data: { id: 1 } });
    }
    return row;
  }

  async update(
    dto: UpdateOrgSettingsDto,
  ): Promise<Omit<OrgSettings, 'smtpPass'> & { smtpPassConfigured: boolean }> {
    await this.get(); // гарантируем существование
    // Семантика smtpPass / clearSmtpPass:
    //  - clearSmtpPass=true  → стираем пароль (юзер сменил SMTP-сервер,
    //    старый пароль в новом контексте бесполезен)
    //  - smtpPass='' / undefined без clearSmtpPass → НЕ менять пароль
    //  - smtpPass='новый' → выставить новый
    const data = { ...dto };
    const shouldClear = data.clearSmtpPass === true;
    delete data.clearSmtpPass; // не поле модели, в Prisma не передаём
    if (shouldClear) {
      data.smtpPass = '';
    } else if (data.smtpPass === '' || data.smtpPass === undefined) {
      delete data.smtpPass;
    } else {
      // Шифруем перед записью в БД (AES-256-GCM, ключ из env).
      // В БД попадёт строка вида 'enc:v1:<iv>:<ct>:<tag>'.
      data.smtpPass = this.cipher.encrypt(data.smtpPass);
    }

    await this.prisma.orgSettings.update({ where: { id: 1 }, data });

    // Перезапускаем cron с новыми расписаниями.
    await this.scheduler.reload();
    // Сбрасываем кэш email-транспорта — следующая отправка пересоздаст с новыми SMTP.
    this.emailProvider.invalidate();

    return this.getPublic();
  }

  /**
   * Установить кастомный логотип. Принимает URL вида `/uploads/logos/<file>`
   * (составляется в контроллере из multer-результата). Сохраняем как есть,
   * чтобы фронт мог использовать значение прямо в `<img src>`.
   *
   * Если был старый кастомный логотип — удаляется с диска (housekeeping,
   * чтобы не накапливать «осиротевшие» файлы).
   */
  async setLogo(url: string) {
    const row = await this.get();

    if (row.logoPath) {
      this.removeLogoFile(row.logoPath);
    }

    await this.prisma.orgSettings.update({
      where: { id: 1 },
      data: { logoPath: url },
    });
    return this.getPublic();
  }

  /**
   * Сбросить логотип на встроенный SVG-дефолт. Удаляет файл с диска.
   */
  async clearLogo() {
    const row = await this.get();
    if (row.logoPath) {
      this.removeLogoFile(row.logoPath);
    }
    await this.prisma.orgSettings.update({
      where: { id: 1 },
      data: { logoPath: null },
    });
    return this.getPublic();
  }

  /**
   * Удаляет файл логотипа с диска. Принимает URL вида `/uploads/logos/<file>`,
   * вычисляет абсолютный путь относительно cwd. Ошибки удаления логирует,
   * но не пробрасывает — БД-запись всё равно надо обновить.
   */
  private removeLogoFile(url: string) {
    // Срезаем ведущий «/» и резолвим относительно cwd процесса (там лежит /uploads).
    const filepath = join(process.cwd(), url.replace(/^[\\/]+/, ''));
    try {
      if (existsSync(filepath)) unlinkSync(filepath);
    } catch (err) {
      this.logger.warn(`Не удалось удалить логотип ${filepath}: ${(err as Error).message}`);
    }
  }

  /** Послать тестовое письмо текущими SMTP-настройками. */
  async sendTestEmail(toEmail: string) {
    return this.emailProvider.sendTest(toEmail);
  }
}
