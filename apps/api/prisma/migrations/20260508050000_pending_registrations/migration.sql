-- Email-верификация переезжает на принцип "не создавать User до подтверждения".
-- Откатываем emailVerifiedAt и email_verification_codes (они хранили данные
-- НА User, а User создавался сразу). Вместо этого вводим pending_registrations
-- — временное хранилище регданных до подтверждения кода.

-- DropForeignKey
ALTER TABLE "email_verification_codes" DROP CONSTRAINT IF EXISTS "email_verification_codes_userId_fkey";

-- DropTable (ничего важного не теряем — таблица была создана недавно и пустая в проде)
DROP TABLE IF EXISTS "email_verification_codes";

-- DropColumn (existing users считаются подтверждёнными по факту существования)
ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerifiedAt";

-- CreateTable: pending_registrations — данные незаконченной регистрации
CREATE TABLE "pending_registrations" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: email и phone уникальны — пока pending активен, никто не
-- может занять эти контакты ни в users, ни в новой pending-записи.
CREATE UNIQUE INDEX "pending_registrations_email_key" ON "pending_registrations"("email");
CREATE UNIQUE INDEX "pending_registrations_phone_key" ON "pending_registrations"("phone");
CREATE INDEX "pending_registrations_expiresAt_idx" ON "pending_registrations"("expiresAt");
