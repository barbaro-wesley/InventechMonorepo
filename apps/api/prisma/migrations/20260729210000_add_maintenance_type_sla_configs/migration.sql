-- SLA por tipo de manutenção, por empresa.
-- Substitui o parâmetro único "preventive_sla_days" (em dias) por uma
-- configuração por tipo, sempre armazenada em HORAS.

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_maintenance_type_sla_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "maintenance_type" "MaintenanceType" NOT NULL,
    "max_response_hours" DECIMAL(8,2),
    "max_resolution_hours" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_maintenance_type_sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_maintenance_type_sla_configs_company_id_maintenance_key"
    ON "company_maintenance_type_sla_configs"("company_id", "maintenance_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "company_maintenance_type_sla_configs_company_id_idx"
    ON "company_maintenance_type_sla_configs"("company_id");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "company_maintenance_type_sla_configs"
        ADD CONSTRAINT "company_maintenance_type_sla_configs_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Seed: preserva o prazo de preventivas já configurado por empresa
-- (preventive_sla_days, em dias) convertendo para horas.
INSERT INTO "company_maintenance_type_sla_configs"
    ("id", "company_id", "maintenance_type", "max_response_hours", "max_resolution_hours", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    c."id",
    'PREVENTIVE'::"MaintenanceType",
    NULL,
    COALESCE(c."preventive_sla_days", 30) * 24,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "companies" c
ON CONFLICT ("company_id", "maintenance_type") DO NOTHING;

-- Seed: prazos padrão dos demais tipos que não seguem o SLA por prioridade.
-- CORRECTIVE fica de fora de propósito — continua usando company_sla_configs.
INSERT INTO "company_maintenance_type_sla_configs"
    ("id", "company_id", "maintenance_type", "max_response_hours", "max_resolution_hours", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    c."id",
    t."maintenance_type"::"MaintenanceType",
    NULL,
    t."resolution_hours",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "companies" c
CROSS JOIN (VALUES
    ('INITIAL_ACCEPTANCE', 72),   -- 3 dias
    ('EXTERNAL_SERVICE',  168),   -- 7 dias
    ('TECHNOVIGILANCE',    72),   -- 3 dias
    ('TRAINING',          720),   -- 30 dias
    ('IMPROPER_USE',       72),   -- 3 dias
    ('DEACTIVATION',      168)    -- 7 dias
) AS t("maintenance_type", "resolution_hours")
ON CONFLICT ("company_id", "maintenance_type") DO NOTHING;
