-- Backfill de dados: corrige equipamentos que deveriam estar INATIVOS.
--
-- Contexto: uma OS de desativação (maintenance_type = 'DEACTIVATION') só inativa
-- o equipamento quando é APROVADA. A aprovação manual fazia isso corretamente,
-- mas o job de auto-aprovação (OS concluídas há mais de 3 dias) atualizava o
-- status da OS direto no banco, sem aplicar o efeito no equipamento. Assim, OS
-- de desativação auto-aprovadas deixavam o equipamento preso em
-- 'UNDER_MAINTENANCE' e a reconciliação periódica ainda o revertia para 'ACTIVE'.
--
-- Esta migration acerta o estado atual: todo equipamento (não excluído) que
-- possua ao menos uma OS de desativação já aprovada passa a ficar 'INACTIVE'.
-- Equipamentos já 'INACTIVE' ou 'SCRAPPED' são preservados.
UPDATE "equipments" AS e
SET "status" = 'INACTIVE',
    "updated_at" = NOW()
WHERE e."deleted_at" IS NULL
  AND e."status" NOT IN ('INACTIVE', 'SCRAPPED')
  AND EXISTS (
    SELECT 1
    FROM "service_orders" AS so
    WHERE so."equipment_id" = e."id"
      AND so."deleted_at" IS NULL
      AND so."status" = 'COMPLETED_APPROVED'
      AND so."maintenance_type" = 'DEACTIVATION'
  );
