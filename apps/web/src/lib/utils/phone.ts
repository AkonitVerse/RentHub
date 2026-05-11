/**
 * Утилиты для работы с российскими номерами телефонов.
 *
 * Канонический формат хранения: +7XXXXXXXXXX (11 цифр, начинается с 7).
 * Канонический формат отображения: +7 (XXX) XXX-XX-XX
 *
 * Принимаем на ввод любую комбинацию: +7, 7, 8, цифры с разделителями.
 * Игнорируем всё, кроме цифр; ведущие 8 заменяем на 7.
 */

/** Извлекает только цифры из строки. */
export const stripPhoneDigits = (input: string): string => input.replace(/\D/g, '');

/**
 * Нормализует ввод к 11-значному номеру (без +).
 * - 8XXXXXXXXXX → 7XXXXXXXXXX
 * - 9XXXXXXXXX  → 79XXXXXXXXX (10 цифр без префикса страны → дописываем 7)
 * - +7XXXXXXXXXX или 7XXXXXXXXXX — как есть.
 *
 * Возвращает строку до 11 цифр (лишние символы обрезаются).
 */
export const normalizePhoneDigits = (input: string): string => {
  let d = stripPhoneDigits(input);
  if (d.length === 0) return '';
  // Ведущая 8 → 7
  if (d[0] === '8') d = '7' + d.slice(1);
  // Если первая цифра не 7 — добавим 7 в начало (пользователь начал с 9XX)
  if (d[0] !== '7') d = '7' + d;
  // Не больше 11 цифр
  return d.slice(0, 11);
};

/**
 * Форматирует строку для отображения в input по мере ввода.
 * Всегда возвращает префикс "+7 " как минимум.
 *
 * Примеры:
 *   ""              → "+7 "
 *   "9"             → "+7 (9"
 *   "923"           → "+7 (923) "
 *   "9234567"       → "+7 (923) 456-7"
 *   "89234567890"   → "+7 (923) 456-78-90"
 */
export const formatPhoneInput = (input: string): string => {
  const d = normalizePhoneDigits(input);
  // d либо пустая, либо начинается с 7
  const rest = d.startsWith('7') ? d.slice(1) : d;
  if (rest.length === 0) return '+7 ';
  if (rest.length <= 3) return `+7 (${rest}`;
  if (rest.length <= 6) return `+7 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
  if (rest.length <= 8) return `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
  return `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`;
};

/**
 * Возвращает каноническую форму для хранения: +7XXXXXXXXXX.
 * Если после нормализации цифр меньше 11 — возвращает пустую строку (валидатор должен отказать).
 */
export const canonicalPhone = (input: string): string => {
  const d = normalizePhoneDigits(input);
  return d.length === 11 ? `+${d}` : '';
};

/** Проверка валидности: ровно 11 цифр после нормализации (включая ведущую 7). */
export const isValidPhone = (input: string): boolean => {
  return normalizePhoneDigits(input).length === 11;
};

/** Сообщение об ошибке для форм. */
export const PHONE_ERROR = 'Введите телефон полностью: +7 (XXX) XXX-XX-XX';
