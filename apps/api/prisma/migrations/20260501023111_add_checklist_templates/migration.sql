-- AlterTable
ALTER TABLE "maintenance_schedules" ADD COLUMN     "checklist_template_id" TEXT;

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "client_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_shared_with_clients" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_checklists" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "service_order_id" TEXT NOT NULL,
    "template_id" TEXT,
    "fields" JSONB NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_order_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_templates_company_id_idx" ON "checklist_templates"("company_id");

-- CreateIndex
CREATE INDEX "checklist_templates_company_id_client_id_idx" ON "checklist_templates"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "checklist_templates_company_id_is_active_idx" ON "checklist_templates"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "service_order_checklists_service_order_id_key" ON "service_order_checklists"("service_order_id");

-- CreateIndex
CREATE INDEX "service_order_checklists_company_id_idx" ON "service_order_checklists"("company_id");

-- CreateIndex
CREATE INDEX "service_order_checklists_service_order_id_idx" ON "service_order_checklists"("service_order_id");

-- CreateIndex
CREATE INDEX "service_order_checklists_template_id_idx" ON "service_order_checklists"("template_id");

-- CreateIndex
CREATE INDEX "maintenance_schedules_checklist_template_id_idx" ON "maintenance_schedules"("checklist_template_id");

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_checklists" ADD CONSTRAINT "service_order_checklists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_checklists" ADD CONSTRAINT "service_order_checklists_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_checklists" ADD CONSTRAINT "service_order_checklists_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_checklists" ADD CONSTRAINT "service_order_checklists_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
