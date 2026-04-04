-- DropIndex
DROP INDEX "service_orders_equipment_id_idx";

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN     "last_maintenance_at" TIMESTAMP(3),
ADD COLUMN     "total_service_orders" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "service_orders_equipment_id_created_at_id_idx" ON "service_orders"("equipment_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "service_order_status_history" ADD CONSTRAINT "service_order_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
