-- Удаляем поддержку юр.лиц: проект ориентируется только на физ.лиц.
-- Можно вернуть позже отдельной миграцией, если понадобится B2B.

ALTER TABLE "clients" DROP COLUMN IF EXISTS "legalForm";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "inn";
DROP TYPE IF EXISTS "LegalForm";
