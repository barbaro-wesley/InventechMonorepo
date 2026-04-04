-- AlterTable
ALTER TABLE "maintenance_schedules" ADD COLUMN     "client_id" TEXT;

-- CreateIndex
CREATE INDEX "maintenance_schedules_company_id_client_id_idx" ON "maintenance_schedules"("company_id", "client_id");

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
