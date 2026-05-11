-- Учёт офлайн-платежей по заказам + поля для возврата с фиксацией повреждений.

CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');
CREATE TYPE "PaymentKind"   AS ENUM ('CHARGE', 'DEPOSIT', 'REFUND');

CREATE TABLE "payments" (
    "id"          SERIAL NOT NULL,
    "orderId"     INTEGER NOT NULL,
    "amount"      INTEGER NOT NULL,
    "method"      "PaymentMethod" NOT NULL,
    "kind"        "PaymentKind" NOT NULL DEFAULT 'CHARGE',
    "paidAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"        TEXT,
    "createdById" INTEGER,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_orderId_fkey"     FOREIGN KEY ("orderId")     REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");
CREATE INDEX "payments_paidAt_idx"  ON "payments"("paidAt");

-- Штраф за день просрочки + повреждения при возврате
ALTER TABLE "equipment"   ADD COLUMN "overduePenaltyPerDay" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order_lines" ADD COLUMN "damageNote" TEXT;
ALTER TABLE "order_lines" ADD COLUMN "damageCost" INTEGER;
