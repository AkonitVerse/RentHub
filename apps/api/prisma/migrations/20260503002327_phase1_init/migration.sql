-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'USER');

-- CreateEnum
CREATE TYPE "WarehouseItemStatus" AS ENUM ('OPERATIONAL', 'BROKEN', 'RETIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'ACTIVE', 'OVERDUE', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MANUAL', 'WEB_CART', 'WEB_INQUIRY');

-- CreateEnum
CREATE TYPE "LegalForm" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PLANNED', 'ACTIVE', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "name" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" INTEGER,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER,
    "description" TEXT NOT NULL,
    "fullDesc" TEXT,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "photos" JSONB,
    "specs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" SERIAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "minDays" INTEGER NOT NULL,
    "maxDays" INTEGER,
    "note" TEXT,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_item_prices" (
    "id" SERIAL NOT NULL,
    "catalogItemId" INTEGER NOT NULL,
    "tierId" INTEGER NOT NULL,
    "pricePerDay" INTEGER NOT NULL,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "catalog_item_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "inventoryNumber" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" "WarehouseItemStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "categoryId" INTEGER,
    "catalogItemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "legalForm" "LegalForm" NOT NULL DEFAULT 'INDIVIDUAL',
    "inn" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "OrderSource" NOT NULL DEFAULT 'MANUAL',
    "inquiryNote" TEXT,
    "inquiryEquipmentId" INTEGER,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "daysCount" INTEGER,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'PICKUP',
    "address" TEXT,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "warehouseItemId" INTEGER,
    "qty" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "unitPriceNet" INTEGER NOT NULL,
    "sumAmount" INTEGER NOT NULL,
    "unitTag" TEXT,
    "returnedAt" TIMESTAMP(3),
    "pricingTierRank" INTEGER,
    "pricingTierMinDays" INTEGER,
    "pricingTierMaxDays" INTEGER,
    "catalogItemDeposit" INTEGER,
    "snapshotAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_log" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "order_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "orderLineId" INTEGER NOT NULL,
    "warehouseItemId" INTEGER NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_extensions" (
    "id" SERIAL NOT NULL,
    "orderLineId" INTEGER NOT NULL,
    "oldToDate" TIMESTAMP(3) NOT NULL,
    "newToDate" TIMESTAMP(3) NOT NULL,
    "addedDays" INTEGER NOT NULL,
    "addedAmount" INTEGER NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_log" (
    "id" SERIAL NOT NULL,
    "warehouseItemId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "cost" INTEGER,

    CONSTRAINT "maintenance_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_parentId_name_key" ON "categories"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_sku_key" ON "equipment"("sku");

-- CreateIndex
CREATE INDEX "equipment_categoryId_idx" ON "equipment"("categoryId");

-- CreateIndex
CREATE INDEX "equipment_isActive_idx" ON "equipment"("isActive");

-- CreateIndex
CREATE INDEX "equipment_isFeatured_idx" ON "equipment"("isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tiers_rank_key" ON "pricing_tiers"("rank");

-- CreateIndex
CREATE INDEX "catalog_item_prices_catalogItemId_idx" ON "catalog_item_prices"("catalogItemId");

-- CreateIndex
CREATE INDEX "catalog_item_prices_tierId_idx" ON "catalog_item_prices"("tierId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_item_prices_catalogItemId_tierId_key" ON "catalog_item_prices"("catalogItemId", "tierId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_items_inventoryNumber_key" ON "warehouse_items"("inventoryNumber");

-- CreateIndex
CREATE INDEX "warehouse_items_status_idx" ON "warehouse_items"("status");

-- CreateIndex
CREATE INDEX "warehouse_items_categoryId_idx" ON "warehouse_items"("categoryId");

-- CreateIndex
CREATE INDEX "warehouse_items_catalogItemId_idx" ON "warehouse_items"("catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_key" ON "clients"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_userId_key" ON "clients"("userId");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_source_idx" ON "orders"("source");

-- CreateIndex
CREATE INDEX "orders_fromDate_toDate_idx" ON "orders"("fromDate", "toDate");

-- CreateIndex
CREATE INDEX "orders_clientId_idx" ON "orders"("clientId");

-- CreateIndex
CREATE INDEX "order_lines_orderId_idx" ON "order_lines"("orderId");

-- CreateIndex
CREATE INDEX "order_lines_equipmentId_idx" ON "order_lines"("equipmentId");

-- CreateIndex
CREATE INDEX "order_lines_warehouseItemId_idx" ON "order_lines"("warehouseItemId");

-- CreateIndex
CREATE INDEX "order_status_log_orderId_idx" ON "order_status_log"("orderId");

-- CreateIndex
CREATE INDEX "reservations_warehouseItemId_fromDate_toDate_idx" ON "reservations"("warehouseItemId", "fromDate", "toDate");

-- CreateIndex
CREATE INDEX "reservations_orderLineId_idx" ON "reservations"("orderLineId");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "rental_extensions_orderLineId_idx" ON "rental_extensions"("orderLineId");

-- CreateIndex
CREATE INDEX "maintenance_log_warehouseItemId_idx" ON "maintenance_log"("warehouseItemId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_prices" ADD CONSTRAINT "catalog_item_prices_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_prices" ADD CONSTRAINT "catalog_item_prices_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "pricing_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_inquiryEquipmentId_fkey" FOREIGN KEY ("inquiryEquipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_warehouseItemId_fkey" FOREIGN KEY ("warehouseItemId") REFERENCES "warehouse_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_log" ADD CONSTRAINT "order_status_log_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_log" ADD CONSTRAINT "order_status_log_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_warehouseItemId_fkey" FOREIGN KEY ("warehouseItemId") REFERENCES "warehouse_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_log" ADD CONSTRAINT "maintenance_log_warehouseItemId_fkey" FOREIGN KEY ("warehouseItemId") REFERENCES "warehouse_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================
-- Защита от пересечения резервов одной физической единицы.
-- Уровень БД-инвариант: даже при ошибке в коде нельзя вставить
-- два пересекающихся PLANNED/ACTIVE-резерва на один warehouseItemId.
-- =====================
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist (
    "warehouseItemId" WITH =,
    tsrange("fromDate", "toDate", '[)') WITH &&
  )
  WHERE ("status" IN ('PLANNED', 'ACTIVE'));
