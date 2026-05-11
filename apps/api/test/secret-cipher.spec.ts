import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import { SecretCipherService } from '../src/common/crypto/secret-cipher';
import type { ConfigService } from '@nestjs/config';

/**
 * Создаёт SecretCipherService с заданным набором env-переменных.
 * ConfigService мокается простой реализацией get(key) → values[key].
 */
function makeCipher(env: Record<string, string | undefined> = {}): SecretCipherService {
  const config = {
    get: (key: string) => env[key],
  } as ConfigService;
  return new SecretCipherService(config);
}

/** Валидный 32-байтовый ключ в base64 — для тестов где нужен явный SECRET_ENCRYPTION_KEY. */
const validKey = randomBytes(32).toString('base64');

describe('SecretCipherService', () => {
  describe('конструктор', () => {
    it('принимает корректный 32-байтовый ключ из env', () => {
      const cipher = makeCipher({ SECRET_ENCRYPTION_KEY: validKey });
      expect(cipher).toBeInstanceOf(SecretCipherService);
    });

    it('падает на ключе неверной длины', () => {
      // 16 байт вместо 32
      const shortKey = randomBytes(16).toString('base64');
      expect(() => makeCipher({ SECRET_ENCRYPTION_KEY: shortKey })).toThrow(/32 байта/);
    });

    it('падает на ключе с битым base64', () => {
      // Строки которые в base64 декодируются НЕ в 32 байта — отлавливаются
      // через проверку длины. (Сам Buffer.from(base64) очень терпим к мусору
      // и почти всегда что-то возвращает, поэтому полагаемся на length-чек.)
      expect(() => makeCipher({ SECRET_ENCRYPTION_KEY: 'too-short' })).toThrow();
    });

    it('fallback на JWT_ACCESS_SECRET если SECRET_ENCRYPTION_KEY не задан', () => {
      const cipher = makeCipher({ JWT_ACCESS_SECRET: 'some-jwt-secret-for-dev-only' });
      // Сам факт что не упал и работает — значит fallback сработал.
      const ct = cipher.encrypt('test');
      expect(cipher.decrypt(ct)).toBe('test');
    });

    it('fallback на встроенную dev-константу если ничего не задано', () => {
      // Не должен падать даже без всех env-переменных — позволяет запустить
      // проект на свежем клонировании без настройки шифрования.
      const cipher = makeCipher({});
      const ct = cipher.encrypt('test');
      expect(cipher.decrypt(ct)).toBe('test');
    });
  });

  describe('encrypt + decrypt (round-trip)', () => {
    const cipher = makeCipher({ SECRET_ENCRYPTION_KEY: validKey });

    it('расшифровывает обратно ASCII-строку', () => {
      const plaintext = 'my-app-password-123';
      const ciphertext = cipher.encrypt(plaintext);
      expect(cipher.decrypt(ciphertext)).toBe(plaintext);
    });

    it('расшифровывает обратно UTF-8 (кириллица + эмодзи)', () => {
      const plaintext = 'Пароль приложения 🔐 от Яндекса';
      const ciphertext = cipher.encrypt(plaintext);
      expect(cipher.decrypt(ciphertext)).toBe(plaintext);
    });

    it('расшифровывает обратно длинную строку', () => {
      const plaintext = 'x'.repeat(10_000);
      const ciphertext = cipher.encrypt(plaintext);
      expect(cipher.decrypt(ciphertext)).toBe(plaintext);
    });

    it('два encrypt одного и того же plaintext дают разные шифры (рандомный IV)', () => {
      // Это ключевое свойство безопасности: одинаковые пароли не должны
      // давать одинаковые шифротексты, иначе атакующий по БД увидит у каких
      // юзеров пароль одинаковый.
      const plaintext = 'same-password';
      const ct1 = cipher.encrypt(plaintext);
      const ct2 = cipher.encrypt(plaintext);
      expect(ct1).not.toBe(ct2);
      // Но оба корректно расшифровываются в исходник.
      expect(cipher.decrypt(ct1)).toBe(plaintext);
      expect(cipher.decrypt(ct2)).toBe(plaintext);
    });
  });

  describe('encrypt — граничные случаи', () => {
    const cipher = makeCipher({ SECRET_ENCRYPTION_KEY: validKey });

    it("encrypt('') возвращает '' — пустоту не шифруем", () => {
      expect(cipher.encrypt('')).toBe('');
    });

    it('encrypt уже зашифрованной строки возвращает её как есть (идемпотентно)', () => {
      // Чтобы случайный двойной encrypt не сломал данные.
      const original = cipher.encrypt('foo');
      const second = cipher.encrypt(original);
      expect(second).toBe(original);
    });

    it('результат encrypt начинается с префикса enc:v1:', () => {
      const ct = cipher.encrypt('any');
      expect(ct.startsWith('enc:v1:')).toBe(true);
    });

    it('формат шифротекста — три base64-сегмента через двоеточие', () => {
      const ct = cipher.encrypt('any').slice('enc:v1:'.length);
      const parts = ct.split(':');
      expect(parts).toHaveLength(3); // iv : ciphertext : authTag
      parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
    });
  });

  describe('decrypt — обратная совместимость и устойчивость', () => {
    const cipher = makeCipher({ SECRET_ENCRYPTION_KEY: validKey });

    it("decrypt('') возвращает ''", () => {
      expect(cipher.decrypt('')).toBe('');
    });

    it('decrypt без префикса возвращает значение как есть (legacy plain)', () => {
      // До внедрения шифрования пароли в БД лежали plain. Они должны
      // продолжать работать — иначе все существующие установки сломаются.
      expect(cipher.decrypt('legacy-plain-password')).toBe('legacy-plain-password');
    });

    it('decrypt с битым форматом (нет нужных частей) падает', () => {
      expect(() => cipher.decrypt('enc:v1:onlyonepart')).toThrow(/формат/);
    });

    it('decrypt с подделанным auth tag падает (защита от tampering)', () => {
      const ct = cipher.encrypt('honest-password');
      // Портим auth-tag (последний сегмент после последнего двоеточия)
      const lastColon = ct.lastIndexOf(':');
      const broken = ct.slice(0, lastColon + 1) + Buffer.from('xxxxxxxxxxxx').toString('base64');
      // GCM детектит подмену и кидает ошибку — это и есть «authenticated» в его названии.
      expect(() => cipher.decrypt(broken)).toThrow();
    });

    it('decrypt чужим ключом падает (нельзя расшифровать без правильного ключа)', () => {
      const cipherA = makeCipher({ SECRET_ENCRYPTION_KEY: validKey });
      const cipherB = makeCipher({ SECRET_ENCRYPTION_KEY: randomBytes(32).toString('base64') });
      const ct = cipherA.encrypt('secret');
      expect(() => cipherB.decrypt(ct)).toThrow();
    });
  });

  describe('isEncrypted', () => {
    const cipher = makeCipher({ SECRET_ENCRYPTION_KEY: validKey });

    it('распознаёт результат encrypt() как зашифрованный', () => {
      const ct = cipher.encrypt('foo');
      expect(cipher.isEncrypted(ct)).toBe(true);
    });

    it('plain-строки не считает зашифрованными', () => {
      expect(cipher.isEncrypted('plain-text')).toBe(false);
      expect(cipher.isEncrypted('')).toBe(false);
      expect(cipher.isEncrypted('enc:v0:wrong-version')).toBe(false);
      expect(cipher.isEncrypted('Enc:v1:wrong-case')).toBe(false);
    });
  });
});
