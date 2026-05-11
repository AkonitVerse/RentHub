import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { NotificationProvider } from './notification-provider.interface';
import { NotificationEvent } from '../notification-event';
import { EmailTemplatesService } from '../../email-templates/email-templates.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SecretCipherService } from '../../../common/crypto/secret-cipher';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromEmail: string;
  fromName: string;
  staffEmails: string[];
}

/**
 * SMTP-провайдер на nodemailer.
 *
 * Конфигурация целиком в БД (OrgSettings). Если поля пустые — fallback на .env
 * (SMTP_HOST/PORT/USER/PASS/FROM/STAFF_EMAIL), чтобы старые деплои продолжали
 * работать без переезда в админку.
 *
 * Транспорт пересоздаётся лениво — при изменении настроек кэш сбрасывается
 * (метод invalidate()), и следующая отправка построит новый транспорт.
 */
@Injectable()
export class EmailNotificationProvider implements NotificationProvider, OnModuleDestroy {
  readonly name = 'email';
  private readonly logger = new Logger('EmailNotifications');

  private cachedTransporter: Transporter | null = null;
  /** Сериализованный signature текущей конфигурации — для определения «изменилось ли». */
  private cachedKey: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly templates: EmailTemplatesService,
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.closeTransporter();
  }

  /** Сбросить кэш — следующая отправка пересоберёт транспорт из свежих настроек. */
  invalidate(): void {
    this.closeTransporter();
    this.cachedKey = null;
  }

  isEnabled(): boolean {
    // Включён, если хоть как-то можно собрать транспорт. Реальная проверка — внутри send().
    return true;
  }

  /**
   * Тестовая отправка: собирает транспорт из текущих настроек и шлёт письмо
   * на указанный адрес. Возвращает результат для UI («Отправить тестовое письмо»).
   *
   * Бренд в письме (subject/body) подставляется из OrgSettings.orgShortName —
   * чтобы при переименовании платформы тестовое письмо тоже отражало новое имя.
   * Если название не задано — fallback на «RentHub» как нейтральный дефолт.
   */
  async sendTest(toEmail: string): Promise<{ ok: true; messageId?: string }> {
    const cfg = await this.loadConfig();
    if (!cfg.host) {
      throw new Error('SMTP-сервер не настроен. Заполните «Адрес сервера» в настройках.');
    }
    const orgRow = await this.prisma.orgSettings.findUnique({
      where: { id: 1 },
      select: { orgShortName: true },
    });
    const brand = orgRow?.orgShortName?.trim() || 'RentHub';

    const transporter = this.getOrBuildTransporter(cfg);
    const from = cfg.fromName ? `"${cfg.fromName}" <${cfg.fromEmail}>` : cfg.fromEmail;
    const result = await transporter.sendMail({
      from,
      to: toEmail,
      subject: `Проверка SMTP — ${brand}`,
      text:
        `Это служебное письмо для проверки настроек почтового сервера платформы ${brand}.\n\n` +
        `Если вы получили это сообщение — SMTP-сервер настроен правильно.`,
      html:
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; ` +
        `max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.5;">` +
        `<p>Это служебное письмо для проверки настроек почтового сервера платформы <b>${brand}</b>.</p>` +
        `<p>Если вы получили это сообщение — SMTP-сервер настроен правильно.</p>` +
        `</div>`,
    });
    return { ok: true, messageId: result.messageId };
  }

  async send(event: NotificationEvent): Promise<void> {
    const cfg = await this.loadConfig();
    if (!cfg.host) {
      // SMTP не настроен — событие пишется в лог через LogNotificationProvider, тут тихо выходим.
      return;
    }

    const recipients = this.resolveRecipients(event, cfg.staffEmails);
    if (recipients.length === 0) return;

    const template = await this.templates.getByEventType(event.type);
    if (!template) {
      this.logger.warn(`Шаблон ${event.type} не найден в БД — письмо не отправлено`);
      return;
    }
    if (!template.enabled) {
      this.logger.debug(`Шаблон ${event.type} отключён админом — пропуск`);
      return;
    }

    // Инжектим brandName из OrgSettings — это универсальная переменная,
    // доступная во всех шаблонах для самопрезентации платформы. Берём
    // orgShortName ("Название сайта" в общих настройках), fallback "RentHub".
    const orgRow = await this.prisma.orgSettings.findUnique({
      where: { id: 1 },
      select: { orgShortName: true },
    });
    const brandName = orgRow?.orgShortName?.trim() || 'RentHub';

    const values = { ...event, brandName } as Record<string, unknown>;
    const subject = EmailTemplatesService.render(template.subject, values);
    const html = EmailTemplatesService.render(template.bodyHtml, values);
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const transporter = this.getOrBuildTransporter(cfg);
    const from = cfg.fromName ? `"${cfg.fromName}" <${cfg.fromEmail}>` : cfg.fromEmail;
    try {
      await transporter.sendMail({
        from,
        to: recipients.join(', '),
        subject,
        text,
        html,
      });
    } catch (err) {
      this.logger.error(
        `Не удалось отправить ${event.type} на ${recipients.join(', ')}: ${(err as Error).message}`,
      );
    }
  }

  // =====================================================
  // Загрузка конфигурации (DB → fallback на .env)
  // =====================================================

  private async loadConfig(): Promise<SmtpConfig> {
    const row = await this.prisma.orgSettings.findUnique({ where: { id: 1 } });

    const host = (row?.smtpHost?.trim() || this.config.get<string>('SMTP_HOST') || '').trim();
    const secure = row?.smtpSecure ?? false;
    // Порт: в БД 0 означает «не задано». Это страховка — UI обычно подставляет
    // реальный порт при сохранении (см. NotificationsPage.buildPayload), но если
    // запись пришла мимо UI (прямой API, legacy, env) и порт не задан —
    // выбираем стандартный для текущего протокола: TLS → 465, STARTTLS → 587.
    // Хардкод 587 без учёта TLS приводил к рассинхрону (TLS на STARTTLS-порту).
    const envPort = Number(this.config.get<string>('SMTP_PORT'));
    const port =
      row?.smtpPort && row.smtpPort > 0 ? row.smtpPort : envPort > 0 ? envPort : secure ? 465 : 587;
    const user = row?.smtpUser?.trim() || this.config.get<string>('SMTP_USER') || '';
    // Пароль в БД может лежать зашифрованным (новые записи) или plain
    // (legacy/из .env). cipher.decrypt сам распознаёт префикс enc:v1: и
    // возвращает plain как есть, если шифрования нет.
    const rawPass = row?.smtpPass || this.config.get<string>('SMTP_PASS') || '';
    const pass = rawPass ? this.cipher.decrypt(rawPass) : '';

    // Email отправителя по приоритету:
    // 1. senderEmail из OrgSettings (если кто-то явно задал — для корпоративных SMTP с алиасами)
    // 2. SMTP-логин (типовой случай: Gmail/Яндекс/Mail.ru — должен совпадать с auth user)
    // 3. .env SMTP_FROM (legacy)
    // 4. noreply@renthub.com (последний fallback, Gmail отклонит — но хоть что-то)
    const fromEmail =
      row?.senderEmail?.trim() ||
      user ||
      this.config.get<string>('SMTP_FROM') ||
      'noreply@renthub.com';

    // Имя отправителя по приоритету:
    // 1. senderName из OrgSettings (legacy, если кто-то явно задавал)
    // 2. orgShortName из «Общие → Название сайта» — основной источник
    // 3. fallback на «RentHub» — без имени Gmail/Яндекс на стороне получателя
    //    подставит человекочитаемое имя из аккаунта SMTP-логина (например
    //    «akacorporation24» для akacorporation24@gmail.com), что выглядит
    //    непрофессионально и нарушает брендинг платформы.
    const fromName = row?.senderName?.trim() || row?.orgShortName?.trim() || 'RentHub';

    const staffEmailsRaw =
      row?.staffEmails?.trim() || this.config.get<string>('SMTP_STAFF_EMAIL') || '';
    const staffEmails = staffEmailsRaw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    return { host, port, user, pass, secure, fromEmail, fromName, staffEmails };
  }

  /**
   * Возвращает закэшированный транспорт. Если SMTP-параметры поменялись —
   * пересоздаёт. Ключ кэша = host:port:user:secure (пароль не включаем — сравнение
   * по нему всё равно не нужно, его поменяют редко и через invalidate()).
   */
  private getOrBuildTransporter(cfg: SmtpConfig): Transporter {
    const key = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.secure}`;
    if (this.cachedTransporter && this.cachedKey === key) {
      return this.cachedTransporter;
    }
    this.closeTransporter();
    this.cachedTransporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      // На STARTTLS-портах требуем upgrade явно — иначе nodemailer может молча
      // продолжить открытым каналом и handshake обрывается с непонятной ошибкой.
      requireTLS: !cfg.secure,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      // На dev-машинах антивирус (ESET/Kaspersky) подменяет TLS-сертификат
      // SMTP-сервера своим. Прод-окружение должно это снять.
      tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });
    this.cachedKey = key;
    this.logger.log(`SMTP-транспорт обновлён: ${cfg.host}:${cfg.port} (secure=${cfg.secure})`);
    return this.cachedTransporter;
  }

  private closeTransporter(): void {
    if (this.cachedTransporter) {
      try {
        this.cachedTransporter.close();
      } catch {
        // ignore
      }
      this.cachedTransporter = null;
    }
  }

  private resolveRecipients(event: NotificationEvent, staffEmails: string[]): string[] {
    if (event.audience === 'STAFF') return staffEmails;
    if (event.audience === 'CLIENT') {
      const e = event as {
        clientEmail?: string | null;
        contactEmail?: string | null;
      };
      const addr = e.clientEmail ?? e.contactEmail ?? null;
      return addr ? [addr] : [];
    }
    return [];
  }
}
