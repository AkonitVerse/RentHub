import type { ChangeEvent, FocusEvent } from 'react';

/**
 * Утилиты нормализации имён/фамилий — единое поведение на регистрации,
 * в профиле клиента и в админских формах создания клиента/сотрудника.
 *
 * Зеркальная логика лежит на backend в src/common/transform/normalize-name.ts —
 * любые правки правил применяй сразу в обоих местах, иначе разъедутся.
 */

/**
 * Стрипает цифры на лету (typing + paste + autofill). Подключается через
 * RHF: `register('firstName', { onChange: stripDigitsOnInput })`.
 *
 * Мутация `e.target.value` переводит DOM-input в очищенное состояние ДО того,
 * как форма прочитает значение, поэтому в стейт RHF попадает уже чистая строка.
 */
export function stripDigitsOnInput(e: ChangeEvent<HTMLInputElement>): void {
  const cleaned = e.target.value.replace(/\d/g, '');
  if (cleaned !== e.target.value) {
    e.target.value = cleaned;
  }
}

/**
 * Делает первую букву каждой составляющей имени заглавной. Разделители частей —
 * пробел, дефис, апостроф. Остальные буквы НЕ трогаем намеренно: "ИВАН" остаётся
 * "ИВАН" если юзер сам так написал, а "McDonald" остаётся "McDonald".
 *
 * Примеры:
 *   "иван"          → "Иван"
 *   "анна-мария"    → "Анна-Мария"
 *   "анна мария"    → "Анна Мария"
 *   "o'connor"      → "O'Connor"
 *   "Иван"          → "Иван"  (без изменений)
 *   "ИВАН"          → "ИВАН"  (специально не lowercase'им)
 */
export function capitalizeName(name: string): string {
  return name.replace(
    /(^|[\s\-'])(\p{L})/gu,
    (_, sep: string, char: string) => sep + char.toUpperCase(),
  );
}

/**
 * onBlur-handler: триммит и капитализирует, затем кладёт значение обратно в
 * форму через сеттер RHF. Подключается так:
 *
 *   <Input
 *     {...form.register('firstName', { onChange: stripDigitsOnInput })}
 *     onBlur={(e) => normalizeNameOnBlur(e, (v) => form.setValue('firstName', v, ...))}
 *   />
 *
 * Капитализация именно на blur, а не на change — чтобы не было прыжков
 * курсора и фоновой "магии" во время набора.
 */
export function normalizeNameOnBlur(
  e: FocusEvent<HTMLInputElement>,
  setValue: (next: string) => void,
): void {
  const raw = e.target.value;
  const trimmed = raw.trim();
  const next = capitalizeName(trimmed);
  if (next !== raw) {
    setValue(next);
  }
}
