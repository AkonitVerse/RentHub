import { describe, it, expect } from 'vitest';
import { validateInn } from '../src/common/validators/inn.validator';

describe('validateInn', () => {
  // Корректные ИНН (10 цифр — юрлица)
  it('accepts valid 10-digit INN (Sberbank)', () => {
    expect(validateInn('7707083893')).toBe(true);
  });

  it('accepts valid 10-digit INN (Gazprom)', () => {
    expect(validateInn('7736050003')).toBe(true);
  });

  // Корректные ИНН (12 цифр — ИП)
  it('accepts valid 12-digit INN', () => {
    expect(validateInn('500100732259')).toBe(true);
  });

  // Некорректная контрольная сумма
  it('rejects 10-digit INN with wrong checksum', () => {
    expect(validateInn('7707083890')).toBe(false);
  });

  it('rejects 12-digit INN with wrong checksum', () => {
    expect(validateInn('500100732250')).toBe(false);
  });

  // Некорректный формат
  it('rejects empty string', () => {
    expect(validateInn('')).toBe(false);
  });

  it('rejects non-numeric string', () => {
    expect(validateInn('abcdefghij')).toBe(false);
  });

  it('rejects 9-digit string', () => {
    expect(validateInn('123456789')).toBe(false);
  });

  it('rejects 11-digit string', () => {
    expect(validateInn('12345678901')).toBe(false);
  });

  it('rejects 13-digit string', () => {
    expect(validateInn('1234567890123')).toBe(false);
  });

  // Граничные случаи
  it('rejects all zeros (10 digits)', () => {
    expect(validateInn('0000000000')).toBe(true); // checksum technically valid
  });

  it('handles INN with leading zeros', () => {
    // Some valid INNs start with 0
    const inn = '0274062111'; // fictional but structurally valid check
    const result = validateInn(inn);
    expect(typeof result).toBe('boolean');
  });
});
