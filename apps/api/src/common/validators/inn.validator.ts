import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

/**
 * Проверяет контрольную сумму российского ИНН.
 * - 10 цифр (юрлицо): weights [2,4,10,3,5,9,4,6,8], check = (sum % 11) % 10 === digit[9]
 * - 12 цифр (ИП/физлицо): две проверки для 11-й и 12-й цифр
 */
export function validateInn(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  const d = inn.split('').map(Number);

  if (d.length === 10) {
    const w = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum = w.reduce((s, wi, i) => s + wi * d[i], 0);
    return (sum % 11) % 10 === d[9];
  }

  // 12 цифр
  const w1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const w2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const sum1 = w1.reduce((s, wi, i) => s + wi * d[i], 0);
  const sum2 = w2.reduce((s, wi, i) => s + wi * d[i], 0);
  return (sum1 % 11) % 10 === d[10] && (sum2 % 11) % 10 === d[11];
}

/**
 * class-validator декоратор для проверки контрольной суммы ИНН.
 * Применяется поверх @Matches для формата, дополнительно проверяет checksum.
 */
export function IsValidInn(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidInn',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Некорректная контрольная сумма ИНН',
        ...options,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return true; // пустое значение проверяется @IsNotEmpty
          return validateInn(value);
        },
      },
    });
  };
}
