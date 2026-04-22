-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "scan_metadata" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "ocr_status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "paciente" TEXT,
    "cpf" TEXT,
    "prontuario" TEXT,
    "numero_atendimento" TEXT,
    "extracted_at" TIMESTAMP(3),

    CONSTRAINT "scan_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scan_metadata_scan_id_key" ON "scan_metadata"("scan_id");

-- CreateIndex
CREATE INDEX "scan_metadata_scan_id_idx" ON "scan_metadata"("scan_id");

-- AddForeignKey
ALTER TABLE "scan_metadata" ADD CONSTRAINT "scan_metadata_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
