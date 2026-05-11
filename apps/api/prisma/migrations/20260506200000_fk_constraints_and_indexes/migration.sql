-- Защита от случайного удаления связанных записей через FK constraints.
-- Раньше FK не имели явного onDelete — Postgres выбрасывал ошибку 23503 без
-- понятного для пользователя сообщения. Теперь:
--   - Order.clientId → Restrict (нельзя удалить клиента с заказами)
--   - OrderLine.equipmentId → Restrict (нельзя удалить оборудование с историей)
--   - OrderLine.warehouseItemId → SetNull (если единицу списали, позиция остаётся)
--   - Reservation.warehouseItemId → Restrict (нельзя списать единицу с резервами)
-- Плюс индекс на User.role для быстрых фильтров админ/менеджер/клиент.

-- Order.clientId: добавляем явное ON DELETE RESTRICT
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_clientId_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderLine.equipmentId: ON DELETE RESTRICT
ALTER TABLE "order_lines" DROP CONSTRAINT IF EXISTS "order_lines_equipmentId_fkey";
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderLine.warehouseItemId: ON DELETE SET NULL (единица может быть списана)
ALTER TABLE "order_lines" DROP CONSTRAINT IF EXISTS "order_lines_warehouseItemId_fkey";
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_warehouseItemId_fkey"
  FOREIGN KEY ("warehouseItemId") REFERENCES "warehouse_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Reservation.warehouseItemId: ON DELETE RESTRICT
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_warehouseItemId_fkey";
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_warehouseItemId_fkey"
  FOREIGN KEY ("warehouseItemId") REFERENCES "warehouse_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index на User.role — без него фильтры по роли (везде в users.list / authentication)
-- делают full scan таблицы users.
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
