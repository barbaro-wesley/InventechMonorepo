-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SlaStatus" AS ENUM ('ON_TIME', 'NEAR_BREACH', 'BREACHED', 'COMPLETED_ON_TIME', 'COMPLETED_LATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "sla_response_due_date" TIMESTAMP(3);
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "sla_resolution_due_date" TIMESTAMP(3);
ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "sla_status" "SlaStatus" DEFAULT 'ON_TIME';

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_sla_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "priority" "ServiceOrderPriority" NOT NULL,
    "max_response_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "max_resolution_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_sla_configs_company_id_priority_key" ON "company_sla_configs"("company_id", "priority");
CREATE INDEX IF NOT EXISTS "company_sla_configs_company_id_idx" ON "company_sla_configs"("company_id");

-- CreateIndex for ServiceOrders
CREATE INDEX IF NOT EXISTS "service_orders_company_id_sla_status_idx" ON "service_orders"("company_id", "sla_status");
CREATE INDEX IF NOT EXISTS "service_orders_sla_resolution_due_date_idx" ON "service_orders"("sla_resolution_due_date");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "company_sla_configs" ADD CONSTRAINT "company_sla_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
