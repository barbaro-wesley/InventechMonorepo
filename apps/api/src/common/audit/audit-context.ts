import { AsyncLocalStorage } from 'node:async_hooks'
import type { AuditAction } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Contexto de auditoria por requisição
//
// O AuditContextInterceptor abre um contexto para cada requisição HTTP com os
// dados do usuário autenticado. A extensão Prisma (src/prisma/audit.extension.ts)
// lê esse contexto para saber QUEM fez cada escrita no banco, sem precisar
// passar o usuário por todos os services.
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
    companyId: string | null
    userId: string | null
    userEmail: string | null
    action: AuditAction
    entity: string
    entityId: string
    changes: Record<string, { from: unknown; to: unknown }> | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    ipAddress: string | null
    userAgent: string | null
    requestId: string | null
    method: string | null
}

export interface AuditContext {
    userId: string | null
    userEmail: string | null
    companyId: string | null
    ipAddress: string | null
    userAgent: string | null
    requestId: string
    method: string | null
    /**
     * Logs gerados durante a requisição. Só são gravados quando o handler
     * termina com sucesso — se a requisição falhar (ex.: rollback de
     * transação), são descartados.
     */
    buffer: AuditEntry[]
    /** Depois do flush, novos logs (ex.: promessas soltas) são gravados direto. */
    flushed: boolean
}

export const auditStorage = new AsyncLocalStorage<AuditContext>()

export function getAuditContext(): AuditContext | undefined {
    return auditStorage.getStore()
}
