-- Раздельные firstName / lastName в User. name остаётся как denormalized
-- полное имя (для совместимости с уже существующим кодом отображения).

ALTER TABLE "users" ADD COLUMN "firstName" TEXT;
ALTER TABLE "users" ADD COLUMN "lastName" TEXT;

-- Бэкфилл: первое слово → firstName, остальные → lastName.
-- Для пустых/одиночных имён используем заглушки, чтобы NOT NULL прошёл.
UPDATE "users"
SET
  "firstName" = COALESCE(NULLIF(TRIM(SPLIT_PART("name", ' ', 1)), ''), 'Имя'),
  "lastName"  = COALESCE(
    NULLIF(TRIM(SUBSTRING("name" FROM POSITION(' ' IN "name") + 1)), ''),
    'Фамилия'
  )
WHERE "firstName" IS NULL OR "lastName" IS NULL;

ALTER TABLE "users" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "lastName" SET NOT NULL;
