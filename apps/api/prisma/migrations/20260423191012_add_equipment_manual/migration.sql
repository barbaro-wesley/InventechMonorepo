-- CreateEnum
CREATE TYPE "ManualType" AS ENUM ('PDF', 'TEXTO', 'LINK');

-- CreateTable
CREATE TABLE "equipment_manuals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "ManualType" NOT NULL,
    "conteudo_texto" TEXT,
    "url" TEXT,
    "file_name" TEXT,
    "stored_name" TEXT,
    "bucket" TEXT,
    "key" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_manuals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_manuals_company_id_idx" ON "equipment_manuals"("company_id");

-- CreateIndex
CREATE INDEX "equipment_manuals_equipment_id_idx" ON "equipment_manuals"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_manuals_equipment_id_ativo_idx" ON "equipment_manuals"("equipment_id", "ativo");

-- AddForeignKey
ALTER TABLE "equipment_manuals" ADD CONSTRAINT "equipment_manuals_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_manuals" ADD CONSTRAINT "equipment_manuals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
