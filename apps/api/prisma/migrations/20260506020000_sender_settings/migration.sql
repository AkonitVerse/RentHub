-- Параметры отправителя писем — теперь настраиваются админом, а не только через .env.
ALTER TABLE "org_settings"
  ADD COLUMN "senderName"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN "senderEmail" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "staffEmails" TEXT NOT NULL DEFAULT '';
