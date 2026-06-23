-- AlterTable
ALTER TABLE "service_order_cost_items" ADD COLUMN     "stock_item_id" TEXT;

-- CreateIndex
CREATE INDEX "service_order_cost_items_stock_item_id_idx" ON "service_order_cost_items"("stock_item_id");

-- AddForeignKey
ALTER TABLE "service_order_cost_items" ADD CONSTRAINT "service_order_cost_items_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
