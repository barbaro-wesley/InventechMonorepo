-- Migration: search indexes em scan_metadata
-- Inclui:
--   1. pg_trgm — busca eficiente com ILIKE '%termo%' via GIN
--   2. B-tree simples nos campos usados para ordenação/filtro exato

-- ── pg_trgm ───────────────────────────────────────────────────────────────────
-- Extensão nativa do PostgreSQL que permite índice GIN em ILIKE com wildcards.
-- Sem ela, qualquer ILIKE '%termo%' faz full scan da tabela.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── GIN indexes (buscas ILIKE '%...%') ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS "scan_metadata_paciente_trgm_idx"
    ON "scan_metadata" USING GIN ("paciente" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "scan_metadata_prontuario_trgm_idx"
    ON "scan_metadata" USING GIN ("prontuario" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "scan_metadata_numero_atendimento_trgm_idx"
    ON "scan_metadata" USING GIN ("numero_atendimento" gin_trgm_ops);

-- ── B-tree indexes (filtros exatos e ordenação) ───────────────────────────────
-- Adicionados ao schema Prisma em sessão anterior — garantidos aqui no banco.
CREATE INDEX IF NOT EXISTS "scan_metadata_paciente_idx"
    ON "scan_metadata"("paciente");

CREATE INDEX IF NOT EXISTS "scan_metadata_prontuario_idx"
    ON "scan_metadata"("prontuario");

CREATE INDEX IF NOT EXISTS "scan_metadata_numero_atendimento_idx"
    ON "scan_metadata"("numero_atendimento");
