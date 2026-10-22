-- Spare parts marketplace purchase flow: SparePartOrder + payment status.

-- CreateEnum
CREATE TYPE "SparePartOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "spare_part_orders" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SparePartOrderStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spare_part_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spare_part_orders_gatewayOrderId_key" ON "spare_part_orders"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "spare_part_orders_customerId_idx" ON "spare_part_orders"("customerId");

-- CreateIndex
CREATE INDEX "spare_part_orders_providerId_idx" ON "spare_part_orders"("providerId");

-- CreateIndex
CREATE INDEX "spare_part_orders_sparePartId_idx" ON "spare_part_orders"("sparePartId");

-- CreateIndex
CREATE INDEX "spare_part_orders_status_createdAt_idx" ON "spare_part_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "spare_part_orders_deletedAt_idx" ON "spare_part_orders"("deletedAt");

-- AddForeignKey
ALTER TABLE "spare_part_orders" ADD CONSTRAINT "spare_part_orders_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "spare_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_part_orders" ADD CONSTRAINT "spare_part_orders_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_part_orders" ADD CONSTRAINT "spare_part_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
