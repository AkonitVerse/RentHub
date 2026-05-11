import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Симметричное шифрование секретов at-rest для хранения в БД.
 *
 * Зачем нужно (а не bcrypt-хеш): SMTP-пароль обязан возвращаться в исходном
 * виде — nodemailer передаёт его в auth. Хеш необратим, не подойдёт.
 * Симметричный шифр позволяет хранить шифротекст в БД и расшифровывать только
 * в момент использования.
 *
 * Алгоритм: AES-256-GCM (authenticated encryption — гарантирует, что
 * шифротекст не подменили).
 *
 * Ключ:
 *   - Берётся из env SECRET_ENCRYPTION_KEY (32 байта в base64).
 *   - Если переменная не задана — выводится из JWT_SECRET через SHA-256
 *     (не идеально, но не падает в деве; в проде ОБЯЗАТЕЛЬНО задавать
 *     отдельный ключ через переменную окружения).
 *
 * Формат хранения: 'enc:v1:<iv-b64>:<ciphertext-b64>:<auth-tag-b64>'
 *   Префикс 'enc:v1:' отличает зашифрованные значения от plain (миграция:
 *   старые plain-пароли продолжают работать, новые сохраняются шифрованными).
 */
@Injectable()
export class SecretCipherService {
  private readonly logger = new Logger('SecretCipher');
  private readonly key: Buffer;

  /** Префикс зашифрованного значения. Меняется при смене схемы. */
  private static readonly PREFIX = 'enc:v1:';
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // GCM-стандарт

  constructor(config: ConfigService) {
    const explicit = config.get<string>('SECRET_ENCRYPTION_KEY');
    if (explicit) {
      try {
        const buf = Buffer.from(explicit, 'base64');
        if (buf.length !== 32) throw new Error('должен быть 32 байта в base64');
        this.key = buf;
        this.logger.log('Используется явный SECRET_ENCRYPTION_KEY из env');
      } catch (err) {
        throw new Error(
          `Некорректный SECRET_ENCRYPTION_KEY: ${(err as Error).message}. ` +
            "Сгенерируйте через: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
        );
      }
    } else {
      // Fallback на dev: производим ключ из JWT_ACCESS_SECRET через SHA-256.
      // В проде это плохая практика (компрометация JWT-секрета = компрометация
      // всех зашифрованных секретов), но позволяет не падать на свежем
      // клонировании репозитория без настройки доп. переменной.
      const fallback =
        config.get<string>('JWT_ACCESS_SECRET') ||
        config.get<string>('JWT_SECRET') ||
        'renthub-dev-fallback-secret';
      this.key = createHash('sha256').update(fallback).digest();
      this.logger.warn(
        'SECRET_ENCRYPTION_KEY не задан — производим ключ из JWT_ACCESS_SECRET. ' +
          'Для прода обязательно задайте отдельную переменную (32 байта base64): ' +
          "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
    }
  }

  /**
   * Шифрует строку. Возвращает строку с префиксом 'enc:v1:' для последующего
   * безошибочного определения «это шифротекст или plain».
   *
   * Пустую строку шифровать смысла нет — возвращаем как есть, чтобы не
   * раздувать БД и сохранить семантику «пусто = нет пароля».
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return '';
    if (this.isEncrypted(plaintext)) return plaintext; // уже зашифровано — не дублируем

    const iv = randomBytes(SecretCipherService.IV_LENGTH);
    const cipher = createCipheriv(SecretCipherService.ALGO, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return (
      SecretCipherService.PREFIX +
      iv.toString('base64') +
      ':' +
      encrypted.toString('base64') +
      ':' +
      authTag.toString('base64')
    );
  }

  /**
   * Расшифровывает строку. Если на входе пришло НЕзашифрованное значение
   * (без префикса) — возвращает как есть. Это нужно для обратной совместимости:
   * пароли, сохранённые до внедрения шифрования, продолжают работать; при
   * следующем сохранении через UI они автоматически перепишутся уже шифрованными.
   */
  decrypt(value: string): string {
    if (!value) return '';
    if (!this.isEncrypted(value)) return value; // legacy plain — отдаём как есть

    const body = value.slice(SecretCipherService.PREFIX.length);
    const [ivB64, cipherB64, tagB64] = body.split(':');
    if (!ivB64 || !cipherB64 || !tagB64) {
      throw new Error('Повреждённый шифротекст: ожидался формат enc:v1:iv:ct:tag');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');

    const decipher = createDecipheriv(SecretCipherService.ALGO, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(SecretCipherService.PREFIX);
  }
}
