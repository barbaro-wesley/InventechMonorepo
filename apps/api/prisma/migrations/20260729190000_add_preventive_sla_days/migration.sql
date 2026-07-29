-- AlterTable: parâmetro de SLA de execução das preventivas (dias) por empresa
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "preventive_sla_days" INTEGER NOT NULL DEFAULT 30;
