import { Transform } from 'class-transformer';

/**
 * Парсер строкового boolean из query-string. Используется в @Transform для DTO.
 *
 * Контекст: глобальный ValidationPipe в main.ts включён с
 * `enableImplicitConversion: true`. Этот режим превращает любое значение
 * в `Boolean(value)` — а в JS `Boolean('false') === true` (любая непустая
 * строка truthy). Без явного Transform `?flag=false` приходит как true.
 *
 * Возвращаем `undefined` для отсутствующих значений, чтобы поля @IsOptional
 * корректно отрабатывали "не задано".
 */
export function parseBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const s = String(value).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

/**
 * Декоратор-обёртка: правильно парсит boolean из query/body.
 *
 * Использует `obj[key]` чтобы получить ИСХОДНОЕ значение (до того как
 * ValidationPipe.transformOptions.enableImplicitConversion успеет
 * превратить строку в Boolean(true)).
 *
 * Применять вместо обычного @Transform для всех опциональных boolean-параметров.
 *
 * @example
 *   class FilterDto {
 *     @TransformBool()
 *     @IsBoolean()
 *     @IsOptional()
 *     isActive?: boolean;
 *   }
 */
export function TransformBool(): PropertyDecorator {
  return Transform(({ obj, key }) => parseBool((obj as Record<string, unknown>)[key as string]));
}
