import { Transform } from 'class-transformer';

/**
 * Нормализация имён / фамилий — точка истины для бэкенда.
 * Зеркало UI-логики лежит во фронте в src/lib/utils/name.ts; правки правил
 * применяй в обоих местах одновременно, иначе данные расходятся.
 *
 *  - триммим пробелы по краям
 *  - первую букву каждой части (split по пробел/дефис/апостроф) делаем
 *    заглавной; остальное не трогаем, чтобы не ломать "McDonald", "ИВАН"
 *    и подобные осознанные случаи.
 *
 * Примеры:
 *   "  иван  "      → "Иван"
 *   "анна-мария"    → "Анна-Мария"
 *   "o'connor"      → "O'Connor"
 *   "Иван"          → "Иван"
 */
export function normalizeName(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(
    /(^|[\s\-'])(\p{L})/gu,
    (_, sep: string, char: string) => sep + char.toUpperCase(),
  );
}

/**
 * Декоратор для DTO-полей `firstName` / `lastName` / `name`.
 *
 *   @NormalizeName()
 *   @IsString()
 *   firstName!: string;
 *
 * Применяется class-transformer'ом ДО валидаторов — то есть в БД попадает
 * уже нормализованное значение, а валидаторы работают с тем же видом, что
 * увидит пользователь в письме / профиле.
 */
export function NormalizeName(): PropertyDecorator {
  return Transform(({ value }) => (typeof value === 'string' ? normalizeName(value) : value));
}
