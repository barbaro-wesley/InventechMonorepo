-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "cost_center_id" TEXT;

-- CreateIndex
CREATE INDEX "locations_client_id_cost_center_id_idx" ON "locations"("client_id", "cost_center_id");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
