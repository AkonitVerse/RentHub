-- Контактные реквизиты организации в singleton-настройках.
-- Используются на витрине, в подписи писем и (в будущем) в шапке договоров.

ALTER TABLE "org_settings"
  ADD COLUMN "orgName"      TEXT NOT NULL DEFAULT '',
  ADD COLUMN "orgShortName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "orgPhone"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN "orgEmail"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN "orgAddress"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN "orgHours"     TEXT NOT NULL DEFAULT '';
