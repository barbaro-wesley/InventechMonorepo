-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

-- CreateTable
CREATE TABLE "equipment_custom_field_definitions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field_type" "CustomFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_custom_field_values" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_custom_field_definitions_company_id_is_active_idx" ON "equipment_custom_field_definitions"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "equipment_custom_field_values_equipment_id_idx" ON "equipment_custom_field_values"("equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_custom_field_values_equipment_id_definition_id_key" ON "equipment_custom_field_values"("equipment_id", "definition_id");

-- AddForeignKey
ALTER TABLE "equipment_custom_field_values" ADD CONSTRAINT "equipment_custom_field_values_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_custom_field_values" ADD CONSTRAINT "equipment_custom_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "equipment_custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
