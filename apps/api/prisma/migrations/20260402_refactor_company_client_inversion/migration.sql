-- DropForeignKey
ALTER TABLE "cost_centers" DROP CONSTRAINT "cost_centers_client_id_fkey";

-- DropForeignKey
ALTER TABLE "equipments" DROP CONSTRAINT "equipments_client_id_fkey";

-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_client_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_schedules" DROP CONSTRAINT "maintenance_schedules_client_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenances" DROP CONSTRAINT "maintenances_client_id_fkey";

-- DropForeignKey
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_client_id_fkey";

-- DropIndex
DROP INDEX "cost_centers_client_id_code_key";

-- DropIndex
DROP INDEX "cost_centers_company_id_client_id_idx";

-- DropIndex
DROP INDEX "equipment_movements_company_id_client_id_idx";

-- DropIndex
DROP INDEX "equipments_client_id_status_idx";

-- DropIndex
DROP INDEX "equipments_client_id_type_id_idx";

-- DropIndex
DROP INDEX "equipments_company_id_client_id_idx";

-- DropIndex
DROP INDEX "locations_client_id_cost_center_id_idx";

-- DropIndex
DROP INDEX "locations_client_id_parent_id_idx";

-- DropIndex
DROP INDEX "locations_company_id_client_id_idx";

-- DropIndex
DROP INDEX "maintenance_schedules_company_id_client_id_idx";

-- DropIndex
DROP INDEX "service_orders_client_id_status_idx";

-- AlterTable
ALTER TABLE "cost_centers" DROP COLUMN "client_id";

-- AlterTable
ALTER TABLE "equipment_movements" DROP COLUMN "client_id";

-- AlterTable
ALTER TABLE "equipment_types" ADD COLUMN "group_id" TEXT;

-- AlterTable
ALTER TABLE "equipments" DROP COLUMN "client_id";

-- AlterTable
ALTER TABLE "locations" DROP COLUMN "client_id";

-- AlterTable
ALTER TABLE "maintenance_schedules" DROP COLUMN "client_id";

-- AlterTable
ALTER TABLE "maintenances" ALTER COLUMN "client_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "service_orders" ALTER COLUMN "client_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "client_maintenance_groups" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_maintenance_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_maintenance_groups_group_id_is_active_idx" ON "client_maintenance_groups"("group_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "client_maintenance_groups_client_id_group_id_key" ON "client_maintenance_groups"("client_id", "group_id");

-- CreateIndex
CREATE INDEX "cost_centers_company_id_idx" ON "cost_centers"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_company_id_code_key" ON "cost_centers"("company_id", "code");

-- CreateIndex
CREATE INDEX "equipment_movements_company_id_idx" ON "equipment_movements"("company_id");

-- CreateIndex
CREATE INDEX "equipment_types_group_id_idx" ON "equipment_types"("group_id");

-- CreateIndex
CREATE INDEX "equipments_company_id_idx" ON "equipments"("company_id");

-- CreateIndex
CREATE INDEX "equipments_company_id_status_idx" ON "equipments"("company_id", "status");

-- CreateIndex
CREATE INDEX "equipments_company_id_type_id_idx" ON "equipments"("company_id", "type_id");

-- CreateIndex
CREATE INDEX "locations_company_id_idx" ON "locations"("company_id");

-- CreateIndex
CREATE INDEX "locations_company_id_parent_id_idx" ON "locations"("company_id", "parent_id");

-- CreateIndex
CREATE INDEX "locations_company_id_cost_center_id_idx" ON "locations"("company_id", "cost_center_id");

-- CreateIndex
CREATE INDEX "maintenance_schedules_company_id_idx" ON "maintenance_schedules"("company_id");

-- CreateIndex
CREATE INDEX "maintenances_company_id_idx" ON "maintenances"("company_id");

-- CreateIndex
CREATE INDEX "service_orders_company_id_idx" ON "service_orders"("company_id");

-- CreateIndex
CREATE INDEX "service_orders_company_id_status_idx" ON "service_orders"("company_id", "status");

-- AddForeignKey
ALTER TABLE "client_maintenance_groups" ADD CONSTRAINT "client_maintenance_groups_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_maintenance_groups" ADD CONSTRAINT "client_maintenance_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "maintenance_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_types" ADD CONSTRAINT "equipment_types_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "maintenance_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
