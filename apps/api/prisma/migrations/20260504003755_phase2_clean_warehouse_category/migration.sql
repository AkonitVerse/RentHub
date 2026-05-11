/*
  Warnings:

  - You are about to drop the column `categoryId` on the `warehouse_items` table. All the data in the column will be lost.
  - Made the column `categoryId` on table `equipment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "equipment" DROP CONSTRAINT "equipment_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_items" DROP CONSTRAINT "warehouse_items_categoryId_fkey";

-- DropIndex
DROP INDEX "warehouse_items_categoryId_idx";

-- AlterTable
ALTER TABLE "equipment" ALTER COLUMN "categoryId" SET NOT NULL;

-- AlterTable
ALTER TABLE "warehouse_items" DROP COLUMN "categoryId",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "purchasePrice" INTEGER,
ADD COLUMN     "warrantyUntil" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
