-- CreateEnum
CREATE TYPE "LaudoStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PENDING_SIGNATURE', 'SIGNED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LaudoReferenceType" AS ENUM ('MAINTENANCE', 'SERVICE_ORDER', 'CUSTOM');

-- CreateTable
CREATE TABLE "laudo_templates" (
    "id"             TEXT NOT NULL,
    "company_id"     TEXT NOT NULL,
    "created_by_id"  TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "reference_type" "LaudoReferenceType" NOT NULL,
    "fields"         JSONB NOT NULL,
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    "deleted_at"     TIMESTAMP(3),

    CONSTRAINT "laudo_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laudos" (
    "id"                  TEXT NOT NULL,
    "company_id"          TEXT NOT NULL,
    "client_id"           TEXT,
    "template_id"         TEXT,
    "service_order_id"    TEXT,
    "maintenance_id"      TEXT,
    "created_by_id"       TEXT NOT NULL,
    "technician_id"       TEXT,
    "approved_by_id"      TEXT,
    "number"              INTEGER NOT NULL,
    "title"               TEXT NOT NULL,
    "status"              "LaudoStatus" NOT NULL DEFAULT 'DRAFT',
    "reference_type"      "LaudoReferenceType" NOT NULL,
    "fields"              JSONB NOT NULL,
    "resolved_variables"  JSONB,
    "notes"               TEXT,
    "pdf_url"             TEXT,
    "esign_document_id"   TEXT,
    "approved_at"         TIMESTAMP(3),
    "signed_at"           TIMESTAMP(3),
    "expires_at"          TIMESTAMP(3),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    "deleted_at"          TIMESTAMP(3),

    CONSTRAINT "laudos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "laudo_templates_company_id_idx" ON "laudo_templates"("company_id");
CREATE INDEX "laudo_templates_company_id_reference_type_idx" ON "laudo_templates"("company_id", "reference_type");

-- CreateIndex
CREATE UNIQUE INDEX "laudos_company_id_number_key" ON "laudos"("company_id", "number");
CREATE INDEX "laudos_company_id_idx" ON "laudos"("company_id");
CREATE INDEX "laudos_company_id_client_id_idx" ON "laudos"("company_id", "client_id");
CREATE INDEX "laudos_company_id_status_idx" ON "laudos"("company_id", "status");
CREATE INDEX "laudos_service_order_id_idx" ON "laudos"("service_order_id");
CREATE INDEX "laudos_maintenance_id_idx" ON "laudos"("maintenance_id");

-- AddForeignKey
ALTER TABLE "laudo_templates" ADD CONSTRAINT "laudo_templates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "laudo_templates" ADD CONSTRAINT "laudo_templates_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "laudos" ADD CONSTRAINT "laudos_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "laudos" ADD CONSTRAINT "laudos_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "laudos" ADD CONSTRAINT "laudos_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "laudo_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "laudos" ADD CONSTRAINT "laudos_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "laudos" ADD CONSTRAINT "laudos_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "laudos" ADD CONSTRAINT "laudos_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "laudos" ADD CONSTRAINT "laudos_service_order_id_fkey"
    FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "laudos" ADD CONSTRAINT "laudos_maintenance_id_fkey"
    FOREIGN KEY ("maintenance_id") REFERENCES "maintenances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
