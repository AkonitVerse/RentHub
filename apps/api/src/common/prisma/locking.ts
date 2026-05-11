import { Prisma } from '@prisma/client';

/**
 * Транзакционные advisory locks для сериализации операций над одними
 * и теми же карточками каталога. Параллельные create/update/extend
 * заказа на разные карточки не блокируют друг друга.
 *
 * Сортировка ID по возрастанию обязательна — иначе пересекающиеся заказы
 * на разные множества карточек могут уйти в deadlock.
 *
 * Namespace 42 закреплён за catalogItem-локами; не переиспользовать
 * для других целей.
 */
const NAMESPACE_CATALOG_ITEM = 42;

export async function withCatalogLock<T>(
  tx: Prisma.TransactionClient,
  catalogItemIds: number[],
  fn: () => Promise<T>,
): Promise<T> {
  const unique = Array.from(new Set(catalogItemIds.filter((id) => Number.isFinite(id))));
  unique.sort((a, b) => a - b);
  for (const id of unique) {
    // Явный CAST: Prisma по умолчанию шлёт integer как BIGINT,
    // а pg_advisory_xact_lock(integer, integer) ожидает int4.
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${NAMESPACE_CATALOG_ITEM}::int, ${id}::int)`,
    );
  }
  return fn();
}
