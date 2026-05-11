const ruDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });
const ruDateLong = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});
const ruDateTime = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const ruRub = new Intl.NumberFormat('ru-RU');

export const fmtRub = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return `${ruRub.format(n)} ₽`;
};

export const fmtDate = (d: Date | string | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return ruDate.format(dt);
};

export const fmtDateLong = (d: Date | string | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return ruDateLong.format(dt);
};

export const fmtDateTime = (d: Date | string | null | undefined): string => {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return ruDateTime.format(dt);
};

export const daysBetween = (from: Date | string, to: Date | string): number => {
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 86_400_000));
};

export const fmtPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return phone;
};

export const declineWord = (n: number, [one, few, many]: [string, string, string]): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

export const fmtDays = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return `${n} ${declineWord(n, ['день', 'дня', 'дней'])}`;
};
