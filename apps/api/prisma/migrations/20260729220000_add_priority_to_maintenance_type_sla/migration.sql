-- Passa o SLA por tipo de manutenção a variar também por prioridade do chamado,
-- na mesma granularidade das corretivas: cada par (tipo, prioridade) tem TPA e
-- prazo de conclusão próprios.
--
-- As linhas existentes (uma por tipo) são preservadas como MEDIUM e replicadas
-- para as outras três prioridades com os mesmos prazos, de modo que nenhum
-- prazo já configurado mude de valor.

-- AlterTable: coluna nula primeiro, para poder fazer o backfill
ALTER TABLE "company_maintenance_type_sla_configs"
    ADD COLUMN IF NOT EXISTS "priority" "ServiceOrderPriority";

-- Backfill: o que existia valia para qualquer prioridade → vira MEDIUM
UPDATE "company_maintenance_type_sla_configs"
SET "priority" = 'MEDIUM'::"ServiceOrderPriority"
WHERE "priority" IS NULL;

-- A chave única antiga (empresa, tipo) impediria as demais prioridades
DROP INDEX IF EXISTS "company_maintenance_type_sla_configs_company_id_maintenance_key";

-- Replica cada linha MEDIUM para as outras três prioridades, mantendo os prazos
INSERT INTO "company_maintenance_type_sla_configs"
    ("id", "company_id", "maintenance_type", "priority", "max_response_hours", "max_resolution_hours", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    s."company_id",
    s."maintenance_type",
    p."priority"::"ServiceOrderPriority",
    s."max_response_hours",
    s."max_resolution_hours",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "company_maintenance_type_sla_configs" s
CROSS JOIN (VALUES ('URGENT'), ('HIGH'), ('LOW')) AS p("priority")
WHERE s."priority" = 'MEDIUM'::"ServiceOrderPriority"
  AND NOT EXISTS (
      SELECT 1 FROM "company_maintenance_type_sla_configs" x
      WHERE x."company_id" = s."company_id"
        AND x."maintenance_type" = s."maintenance_type"
        AND x."priority" = p."priority"::"ServiceOrderPriority"
  );

-- Agora que toda linha tem prioridade, a coluna pode ser obrigatória
ALTER TABLE "company_maintenance_type_sla_configs"
    ALTER COLUMN "priority" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_maintenance_type_sla_configs_company_type_priority_key"
    ON "company_maintenance_type_sla_configs"("company_id", "maintenance_type", "priority");
