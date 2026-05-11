/**
 * Проверяет контрольную сумму российского ИНН.
 * - 10 цифр (юрлицо): weights [2,4,10,3,5,9,4,6,8]
 * - 12 цифр (ИП/физлицо): два прохода
 */
export function validateInn(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  const d = inn.split('').map(Number);

  if (d.length === 10) {
    const w = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum = w.reduce((s, wi, i) => s + wi * d[i], 0);
    return (sum % 11) % 10 === d[9];
  }

  const w1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const w2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const sum1 = w1.reduce((s, wi, i) => s + wi * d[i], 0);
  const sum2 = w2.reduce((s, wi, i) => s + wi * d[i], 0);
  return (sum1 % 11) % 10 === d[10] && (sum2 % 11) % 10 === d[11];
}
