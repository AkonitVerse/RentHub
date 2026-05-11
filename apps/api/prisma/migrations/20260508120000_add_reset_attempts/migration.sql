-- Добавляет счётчик неудачных попыток на код сброса пароля.
-- После 5 неверных вводов код помечается used=true и юзеру надо запросить новый.
ALTER TABLE "password_reset_codes" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
