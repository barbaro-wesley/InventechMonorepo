-- CreateEnum
CREATE TYPE "LabelReferenceType" AS ENUM ('EQUIPMENT', 'SERVICE_ORDER');

-- CreateTable
CREATE TABLE "label_templates" (
    "id"             TEXT NOT NULL,
    "company_id"     TEXT NOT NULL,
    "created_by_id"  TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "reference_type" "LabelReferenceType" NOT NULL,
    "layout"         JSONB NOT NULL,
    "is_default"     BOOLEAN NOT NULL DEFAULT false,
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    "deleted_at"     TIMESTAMP(3),

    CONSTRAINT "label_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "label_templates_company_id_idx" ON "label_templates"("company_id");
CREATE INDEX "label_templates_company_id_reference_type_idx" ON "label_templates"("company_id", "reference_type");

-- AddForeignKey
ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
