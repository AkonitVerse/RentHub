-- AlterTable: remove unused penalty/damage fields
ALTER TABLE "equipment" DROP COLUMN IF EXISTS "overduePenaltyPerDay";
ALTER TABLE "order_lines" DROP COLUMN IF EXISTS "damageNote";
ALTER TABLE "order_lines" DROP COLUMN IF EXISTS "damageCost";
