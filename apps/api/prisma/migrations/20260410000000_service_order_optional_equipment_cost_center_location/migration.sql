-- Make equipment_id optional (OS can exist without equipment)
ALTER TABLE "service_orders" ALTER COLUMN "equipment_id" DROP NOT NULL;

-- Add cost_center_id and location_id directly on service_orders
ALTER TABLE "service_orders" ADD COLUMN "cost_center_id" TEXT;
ALTER TABLE "service_orders" ADD COLUMN "location_id" TEXT;

-- Foreign key constraints
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_cost_center_id_fkey"
  FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for new columns
CREATE INDEX "service_orders_cost_center_id_idx" ON "service_orders"("cost_center_id");
CREATE INDEX "service_orders_location_id_idx" ON "service_orders"("location_id");
