-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'PROCESSED', 'ERROR');

-- CreateTable
CREATE TABLE "printers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cost_center_id" TEXT,
    "name" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "model" TEXT,
    "brand" TEXT,
    "sftp_directory" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "printer_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "error_msg" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "printers_sftp_directory_key" ON "printers"("sftp_directory");

-- CreateIndex
CREATE INDEX "printers_company_id_idx" ON "printers"("company_id");

-- CreateIndex
CREATE INDEX "printers_company_id_is_active_idx" ON "printers"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "printers_cost_center_id_idx" ON "printers"("cost_center_id");

-- CreateIndex
CREATE INDEX "scans_company_id_idx" ON "scans"("company_id");

-- CreateIndex
CREATE INDEX "scans_company_id_printer_id_idx" ON "scans"("company_id", "printer_id");

-- CreateIndex
CREATE INDEX "scans_company_id_status_idx" ON "scans"("company_id", "status");

-- CreateIndex
CREATE INDEX "scans_printer_id_scanned_at_idx" ON "scans"("printer_id", "scanned_at" DESC);

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
