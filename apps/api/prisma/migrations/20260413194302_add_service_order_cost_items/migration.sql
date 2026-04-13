-- CreateEnum
CREATE TYPE "CostItemType" AS ENUM ('LABOR', 'MATERIAL', 'EXTERNAL', 'TRAVEL', 'OTHER');

-- AlterTable
ALTER TABLE "service_orders" ADD COLUMN     "total_cost" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "service_order_cost_items" (
    "id" TEXT NOT NULL,
    "service_order_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "CostItemType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_order_cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_order_cost_items_service_order_id_idx" ON "service_order_cost_items"("service_order_id");

-- AddForeignKey
ALTER TABLE "service_order_cost_items" ADD CONSTRAINT "service_order_cost_items_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
