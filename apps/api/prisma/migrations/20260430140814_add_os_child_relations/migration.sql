-- AlterTable
ALTER TABLE "maintenance_schedules" ADD COLUMN     "origin_service_order_id" TEXT;

-- AlterTable
ALTER TABLE "service_orders" ADD COLUMN     "parent_service_order_id" TEXT;

-- CreateIndex
CREATE INDEX "maintenance_schedules_origin_service_order_id_idx" ON "maintenance_schedules"("origin_service_order_id");

-- CreateIndex
CREATE INDEX "service_orders_parent_service_order_id_idx" ON "service_orders"("parent_service_order_id");

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_origin_service_order_id_fkey" FOREIGN KEY ("origin_service_order_id") REFERENCES "service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_parent_service_order_id_fkey" FOREIGN KEY ("parent_service_order_id") REFERENCES "service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
