-- Конфигурация SMTP-транспорта переезжает из .env в админку.
-- Пустые значения = fallback на .env (для совместимости с уже настроенным деплоем).
ALTER TABLE "org_settings"
  ADD COLUMN "smtpHost"   TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "smtpPort"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "smtpUser"   TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "smtpPass"   TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "smtpSecure" BOOLEAN NOT NULL DEFAULT false;
