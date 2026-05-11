-- Перенос телефона на User. Раньше телефон жил только в Client, что
-- приводило к потере данных при чистке таблицы клиентов. Теперь телефон —
-- атрибут пользовательского профиля (как и email).

ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- Бэкфилл: для каждого user-а, у которого есть привязанный Client с телефоном,
-- копируем телефон в users.phone.
UPDATE "users" u
SET "phone" = c."phone"
FROM "clients" c
WHERE c."userId" = u."id" AND c."phone" IS NOT NULL;

-- Уникальный индекс. NULL допустимы (админ/менеджер могут не иметь телефона).
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
