-- CreateTable
CREATE TABLE "scan_file_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "subfolder" TEXT,
    "file_size_bytes" INTEGER,
    "file_modified_at" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_file_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_file_events_company_id_detected_at_idx" ON "scan_file_events"("company_id", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "scan_file_events_company_id_subfolder_idx" ON "scan_file_events"("company_id", "subfolder");

-- CreateIndex
CREATE UNIQUE INDEX "scan_file_events_company_id_file_path_key" ON "scan_file_events"("company_id", "file_path");

-- AddForeignKey
ALTER TABLE "scan_file_events" ADD CONSTRAINT "scan_file_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
