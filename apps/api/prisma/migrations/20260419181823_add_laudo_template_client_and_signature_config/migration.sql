-- AlterTable
ALTER TABLE "laudo_templates" ADD COLUMN     "client_id" TEXT,
ADD COLUMN     "is_shared_with_clients" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signature_config" JSONB;

-- CreateIndex
CREATE INDEX "laudo_templates_company_id_client_id_idx" ON "laudo_templates"("company_id", "client_id");

-- AddForeignKey
ALTER TABLE "laudo_templates" ADD CONSTRAINT "laudo_templates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
