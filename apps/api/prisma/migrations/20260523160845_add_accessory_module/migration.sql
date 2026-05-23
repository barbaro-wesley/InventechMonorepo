-- CreateEnum
CREATE TYPE "AccessoryStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'UNDER_MAINTENANCE', 'LOANED', 'SCRAPPED', 'LOST');

-- CreateEnum
CREATE TYPE "AccessoryOwnership" AS ENUM ('COMPANY', 'CLIENT', 'LEASED', 'DONATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttachmentEntity" ADD VALUE 'ACCESSORY';
ALTER TYPE "AttachmentEntity" ADD VALUE 'ACCESSORY_MAINTENANCE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'ACCESSORY_CREATED';
ALTER TYPE "EventType" ADD VALUE 'ACCESSORY_ASSIGNED';
ALTER TYPE "EventType" ADD VALUE 'ACCESSORY_UNASSIGNED';
ALTER TYPE "EventType" ADD VALUE 'ACCESSORY_MOVED';
ALTER TYPE "EventType" ADD VALUE 'ACCESSORY_MAINTENANCE_COMPLETED';
ALTER TYPE "EventType" ADD VALUE 'ACCESSORY_WARRANTY_EXPIRING';
ALTER TYPE "EventType" ADD VALUE 'ACCESSORY_STATUS_CHANGED';

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "accessory_id" TEXT,
ADD COLUMN     "accessory_maintenance_id" TEXT;

-- CreateTable
CREATE TABLE "accessory_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_accessory_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "equipment_type_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "min_quantity" INTEGER NOT NULL DEFAULT 1,
    "max_quantity" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_accessory_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "patrimony_number" TEXT,
    "qr_code" TEXT,
    "anvisa_number" TEXT,
    "ownership" "AccessoryOwnership" NOT NULL DEFAULT 'COMPANY',
    "purchase_value" DECIMAL(12,2),
    "purchase_date" DATE,
    "invoice_number" TEXT,
    "warranty_start" DATE,
    "warranty_end" DATE,
    "status" "AccessoryStatus" NOT NULL DEFAULT 'AVAILABLE',
    "criticality" "EquipmentCriticality" NOT NULL DEFAULT 'MEDIUM',
    "observations" TEXT,
    "current_location_id" TEXT,
    "current_equipment_id" TEXT,
    "last_maintenance_at" TIMESTAMP(3),
    "total_maintenances" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_assignments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "accessory_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "unassigned_by_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),
    "reason" TEXT,
    "unassign_reason" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "equipment_snapshot" JSONB,

    CONSTRAINT "accessory_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "accessory_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "approver_id" TEXT,
    "type" "MovementType" NOT NULL,
    "status" "MovementStatus" NOT NULL DEFAULT 'ACTIVE',
    "origin_location_id" TEXT NOT NULL,
    "destination_location_id" TEXT NOT NULL,
    "reason" TEXT,
    "expected_return_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_maintenances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "accessory_id" TEXT NOT NULL,
    "technician_id" TEXT,
    "type" "MaintenanceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "observations" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessory_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_status_history" (
    "id" TEXT NOT NULL,
    "accessory_id" TEXT NOT NULL,
    "from_status" "AccessoryStatus",
    "to_status" "AccessoryStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accessory_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accessory_categories_company_id_is_active_idx" ON "accessory_categories"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "accessory_categories_company_id_name_key" ON "accessory_categories"("company_id", "name");

-- CreateIndex
CREATE INDEX "equipment_accessory_templates_company_id_idx" ON "equipment_accessory_templates"("company_id");

-- CreateIndex
CREATE INDEX "equipment_accessory_templates_equipment_type_id_idx" ON "equipment_accessory_templates"("equipment_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_accessory_templates_equipment_type_id_category_id_key" ON "equipment_accessory_templates"("equipment_type_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "accessories_qr_code_key" ON "accessories"("qr_code");

-- CreateIndex
CREATE INDEX "accessories_company_id_idx" ON "accessories"("company_id");

-- CreateIndex
CREATE INDEX "accessories_company_id_status_idx" ON "accessories"("company_id", "status");

-- CreateIndex
CREATE INDEX "accessories_company_id_category_id_idx" ON "accessories"("company_id", "category_id");

-- CreateIndex
CREATE INDEX "accessories_company_id_current_equipment_id_idx" ON "accessories"("company_id", "current_equipment_id");

-- CreateIndex
CREATE INDEX "accessories_serial_number_idx" ON "accessories"("serial_number");

-- CreateIndex
CREATE INDEX "accessories_patrimony_number_idx" ON "accessories"("patrimony_number");

-- CreateIndex
CREATE INDEX "accessories_qr_code_idx" ON "accessories"("qr_code");

-- CreateIndex
CREATE INDEX "accessories_warranty_end_idx" ON "accessories"("warranty_end");

-- CreateIndex
CREATE INDEX "accessory_assignments_company_id_idx" ON "accessory_assignments"("company_id");

-- CreateIndex
CREATE INDEX "accessory_assignments_accessory_id_is_active_idx" ON "accessory_assignments"("accessory_id", "is_active");

-- CreateIndex
CREATE INDEX "accessory_assignments_equipment_id_is_active_idx" ON "accessory_assignments"("equipment_id", "is_active");

-- CreateIndex
CREATE INDEX "accessory_assignments_assigned_at_idx" ON "accessory_assignments"("assigned_at");

-- CreateIndex
CREATE INDEX "accessory_movements_company_id_idx" ON "accessory_movements"("company_id");

-- CreateIndex
CREATE INDEX "accessory_movements_accessory_id_status_idx" ON "accessory_movements"("accessory_id", "status");

-- CreateIndex
CREATE INDEX "accessory_movements_accessory_id_created_at_idx" ON "accessory_movements"("accessory_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "accessory_maintenances_company_id_idx" ON "accessory_maintenances"("company_id");

-- CreateIndex
CREATE INDEX "accessory_maintenances_accessory_id_idx" ON "accessory_maintenances"("accessory_id");

-- CreateIndex
CREATE INDEX "accessory_maintenances_accessory_id_completed_at_idx" ON "accessory_maintenances"("accessory_id", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "accessory_maintenances_technician_id_idx" ON "accessory_maintenances"("technician_id");

-- CreateIndex
CREATE INDEX "accessory_status_history_accessory_id_idx" ON "accessory_status_history"("accessory_id");

-- CreateIndex
CREATE INDEX "accessory_status_history_accessory_id_created_at_idx" ON "accessory_status_history"("accessory_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_accessory_id_fkey" FOREIGN KEY ("accessory_id") REFERENCES "accessories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_accessory_maintenance_id_fkey" FOREIGN KEY ("accessory_maintenance_id") REFERENCES "accessory_maintenances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_accessory_templates" ADD CONSTRAINT "equipment_accessory_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "accessory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_accessory_templates" ADD CONSTRAINT "equipment_accessory_templates_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "accessory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_current_location_id_fkey" FOREIGN KEY ("current_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_current_equipment_id_fkey" FOREIGN KEY ("current_equipment_id") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_assignments" ADD CONSTRAINT "accessory_assignments_accessory_id_fkey" FOREIGN KEY ("accessory_id") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_assignments" ADD CONSTRAINT "accessory_assignments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_assignments" ADD CONSTRAINT "accessory_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_assignments" ADD CONSTRAINT "accessory_assignments_unassigned_by_id_fkey" FOREIGN KEY ("unassigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_movements" ADD CONSTRAINT "accessory_movements_accessory_id_fkey" FOREIGN KEY ("accessory_id") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_movements" ADD CONSTRAINT "accessory_movements_origin_location_id_fkey" FOREIGN KEY ("origin_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_movements" ADD CONSTRAINT "accessory_movements_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_movements" ADD CONSTRAINT "accessory_movements_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_movements" ADD CONSTRAINT "accessory_movements_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_maintenances" ADD CONSTRAINT "accessory_maintenances_accessory_id_fkey" FOREIGN KEY ("accessory_id") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_maintenances" ADD CONSTRAINT "accessory_maintenances_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_status_history" ADD CONSTRAINT "accessory_status_history_accessory_id_fkey" FOREIGN KEY ("accessory_id") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_status_history" ADD CONSTRAINT "accessory_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- PARTIAL UNIQUE INDEXES — não gerados automaticamente pelo Prisma
-- ============================================================

-- Garante que cada acessório possui no máximo 1 atribuição ativa por vez.
-- Esta é a constraint mais crítica do domínio de acessórios.
CREATE UNIQUE INDEX "accessory_single_active_assignment"
  ON "accessory_assignments"("accessory_id")
  WHERE "is_active" = TRUE;

-- Garante unicidade de número de patrimônio por empresa (ignora nulos e deletados)
CREATE UNIQUE INDEX "accessory_patrimony_per_company"
  ON "accessories"("company_id", "patrimony_number")
  WHERE "patrimony_number" IS NOT NULL
    AND "deleted_at" IS NULL;

-- Garante unicidade de número de série por empresa (ignora nulos e deletados)
CREATE UNIQUE INDEX "accessory_serial_per_company"
  ON "accessories"("company_id", "serial_number")
  WHERE "serial_number" IS NOT NULL
    AND "deleted_at" IS NULL;
