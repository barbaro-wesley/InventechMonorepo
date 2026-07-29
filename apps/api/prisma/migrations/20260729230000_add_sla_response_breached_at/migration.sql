-- Registro durável do estouro do prazo de primeiro atendimento (TPA).
--
-- Antes, o estouro de TPA só existia como slaStatus = BREACHED, que o job de
-- reclassificação revertia para ON_TIME assim que a OS era iniciada — a
-- violação desaparecia do histórico. Este campo é gravado na primeira detecção
-- e nunca limpo, servindo de base para a métrica de cumprimento de TPA
-- independente da métrica de conclusão.

-- AlterTable
ALTER TABLE "service_orders"
    ADD COLUMN IF NOT EXISTS "sla_response_breached_at" TIMESTAMP(3);

-- Backfill: OS que comprovadamente estouraram o TPA e já podem ser auditadas.
-- Para as que já iniciaram, usa started_at (momento em que o atraso se
-- consumou); para as que seguem sem início, o próprio prazo vencido.
UPDATE "service_orders"
SET "sla_response_breached_at" = CASE
        WHEN "started_at" IS NOT NULL THEN "started_at"
        ELSE "sla_response_due_date"
    END
WHERE "sla_response_breached_at" IS NULL
  AND "sla_response_due_date" IS NOT NULL
  AND (
        ("started_at" IS NOT NULL AND "started_at" > "sla_response_due_date")
     OR ("started_at" IS NULL AND NOW() > "sla_response_due_date")
  );

-- CreateIndex
-- Índice simples de propósito: um índice parcial (WHERE ... IS NOT NULL) seria
-- melhor para as consultas de auditoria, mas o Prisma não consegue expressá-lo
-- no schema, o que geraria drift entre schema.prisma e o banco.
CREATE INDEX IF NOT EXISTS "service_orders_sla_response_breached_at_idx"
    ON "service_orders"("sla_response_breached_at");
