-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankBik" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactPosition" TEXT,
ADD COLUMN     "inn" TEXT,
ADD COLUMN     "kpp" TEXT,
ADD COLUMN     "legalAddress" TEXT,
ADD COLUMN     "ogrn" TEXT;

-- CreateIndex
CREATE INDEX "clients_clientType_idx" ON "clients"("clientType");

-- CreateIndex
CREATE INDEX "clients_inn_idx" ON "clients"("inn");
