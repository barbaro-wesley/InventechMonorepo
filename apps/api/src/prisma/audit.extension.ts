import { Logger } from '@nestjs/common'
import { Prisma, PrismaClient, AuditAction } from '@prisma/client'
import { AuditEntry, getAuditContext } from '../common/audit/audit-context'

// ─────────────────────────────────────────────────────────────────────────────
// Extensão Prisma de auditoria
//
// Intercepta toda escrita (create/update/upsert/delete e versões *Many) nos
// models de negócio e registra em `audit_logs`:
//   • quem fez (usuário do AuditContext, ou null = sistema/cron)
//   • o que mudou e pelo que foi substituído: changes = { campo: { from, to } }
//   • snapshots completos antes/depois
//
// Leituras do estado anterior e a gravação dos logs usam o client BASE (sem a
// extensão de soft delete e sem auditoria, para não auditar a si mesmo).
//
// Limitações conhecidas:
//   • SQL fora da aplicação (psql, migrations) não é capturado.
//   • O "antes" é lido fora da transação interativa: um registro criado e
//     alterado na mesma transação aparece sem estado anterior.
//   • Escritas aninhadas (ex.: create com { relacao: { create: [...] } })
//     são registradas apenas no registro pai.
// ─────────────────────────────────────────────────────────────────────────────

const logger = new Logger('AuditExtension')

/** Models que NÃO são auditados (ruído, segurança — login tem auditoria própria — ou já são históricos). */
const AUDIT_EXCLUDED = new Set<string>([
    'AuditLog',
    'RefreshToken',
    'LoginAttempt',
    'AccountBlock',
    'TwoFactorCode',
    'EmailVerification',
    'PasswordReset',
    'Notification',
    'ESignEvent',
    'ServiceOrderStatusHistory',
    'AccessoryStatusHistory',
    'scan_file_events',
])

/** Campos ignorados no diff (mudam sozinhos ou já são auditados em outro lugar). */
const IGNORED_FIELDS = new Set<string>(['updatedAt', 'lastLoginAt', 'lastLoginIp'])

/** Campos sensíveis: o valor nunca é gravado, só o fato de ter mudado. */
const SENSITIVE_FIELD = /password|token|secret|apikey/i
const REDACTED = '[REDACTED]'

type Row = Record<string, unknown>

// ─── Metadados dos models (DMMF) ─────────────────────────────────────────────

interface ModelMeta {
    delegate: string
    scalarFields: Set<string>
    decimalFields: Set<string>
    idFields: string[]
}

// Obs.: o DMMF de runtime do Prisma 7 não traz `isId`; todos os models usam
// `id`, exceto chaves compostas (@@id), tratadas via primaryKey/where.
const modelMeta = new Map<string, ModelMeta>()
for (const m of Prisma.dmmf.datamodel.models) {
    const scalars = m.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum')
    const names = new Set(scalars.map((f) => f.name))
    const idField = scalars.find((f) => f.isId)?.name ?? (names.has('id') ? 'id' : undefined)
    modelMeta.set(m.name, {
        delegate: m.name.charAt(0).toLowerCase() + m.name.slice(1),
        scalarFields: names,
        decimalFields: new Set(scalars.filter((f) => f.type === 'Decimal').map((f) => f.name)),
        idFields: idField ? [idField] : [...(m.primaryKey?.fields ?? [])],
    })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Converte Decimal/Date/BigInt em valores JSON e mantém só campos escalares. */
function snapshot(meta: ModelMeta, row: unknown): Row | null {
    if (!row || typeof row !== 'object') return null
    const out: Row = {}
    for (const [k, v] of Object.entries(row as Row)) {
        if (!meta.scalarFields.has(k)) continue
        out[k] = SENSITIVE_FIELD.test(k) ? REDACTED : toJsonValue(v)
    }
    return out
}

function toJsonValue(v: unknown): unknown {
    if (v === null || v === undefined) return null
    if (typeof v === 'bigint') return v.toString()
    if (v instanceof Date) return v.toISOString()
    if (Prisma.Decimal.isDecimal(v)) return (v as Prisma.Decimal).toString()
    if (typeof v === 'object') return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)))
    return v
}

/**
 * Aplica `data` de um update sobre o estado anterior, para saber o estado
 * novo sem precisar reler o registro (o que falharia dentro de transações).
 * Suporta valores diretos, { set } e operações numéricas.
 */
function applyData(meta: ModelMeta, before: Row | null, data: unknown): Row {
    const after: Row = { ...(before ?? {}) }
    if (!data || typeof data !== 'object') return after
    for (const [k, raw] of Object.entries(data as Row)) {
        if (!meta.scalarFields.has(k) || raw === undefined) continue
        if (SENSITIVE_FIELD.test(k)) {
            after[k] = REDACTED
            continue
        }
        if (raw !== null && typeof raw === 'object' && !(raw instanceof Date) && !Prisma.Decimal.isDecimal(raw) && !Array.isArray(raw)) {
            const op = raw as Row
            const current = Number(before?.[k] ?? 0)
            if ('set' in op) after[k] = toJsonValue(op.set)
            else if ('increment' in op) after[k] = current + Number(op.increment)
            else if ('decrement' in op) after[k] = current - Number(op.decrement)
            else if ('multiply' in op) after[k] = current * Number(op.multiply)
            else if ('divide' in op) after[k] = current / Number(op.divide)
            else after[k] = toJsonValue(raw) // campo Json
            continue
        }
        after[k] = toJsonValue(raw)
    }
    // Decimal sempre como string (igual ao que vem do banco), para o diff não
    // acusar "100" → 100 como alteração.
    for (const k of meta.decimalFields) {
        if (after[k] !== null && after[k] !== undefined) after[k] = new Prisma.Decimal(after[k] as string).toString()
    }
    return after
}

/** Mescla o resultado da query (pode ter select parcial) sobre um estado base. */
function mergeResult(meta: ModelMeta, base: Row | null, result: unknown): Row {
    return { ...(base ?? {}), ...(snapshot(meta, result) ?? {}) }
}

function diff(before: Row | null, after: Row | null): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
    for (const k of keys) {
        if (IGNORED_FIELDS.has(k)) continue
        if (after && !(k in after)) continue
        const from = before?.[k] ?? null
        const to = after?.[k] ?? null
        if (JSON.stringify(from) === JSON.stringify(to)) {
            // campo sensível alterado: o valor é sempre [REDACTED], então
            // comparamos pela presença no `data` (tratado em changedSensitive)
            continue
        }
        changes[k] = { from, to }
    }
    return changes
}

/** Campos sensíveis presentes no data de um update são registrados como alterados. */
function changedSensitive(meta: ModelMeta, data: unknown): Record<string, { from: unknown; to: unknown }> {
    const out: Record<string, { from: unknown; to: unknown }> = {}
    if (!data || typeof data !== 'object') return out
    for (const k of Object.keys(data as Row)) {
        if (meta.scalarFields.has(k) && SENSITIVE_FIELD.test(k)) out[k] = { from: REDACTED, to: REDACTED }
    }
    return out
}

function entityIdOf(meta: ModelMeta, row: Row | null, where?: unknown): string {
    const src: Row = { ...((where as Row) ?? {}), ...(row ?? {}) }
    const values = meta.idFields.map((f) => src[f]).filter((v) => v !== undefined && v !== null)
    if (values.length) return values.map(String).join(':')
    // where com chave composta: { stockPointId_clientId: { ... } }
    const compound = Object.values((where as Row) ?? {}).find((v) => v && typeof v === 'object') as Row | undefined
    return compound ? Object.values(compound).map(String).join(':') : 'unknown'
}

/** UPDATE que preenche/limpa deletedAt é, na prática, um DELETE/RESTORE (soft delete). */
function classifyUpdate(before: Row | null, after: Row): AuditAction {
    if (before && 'deletedAt' in after) {
        if (!before.deletedAt && after.deletedAt) return AuditAction.DELETE
        if (before.deletedAt && !after.deletedAt) return AuditAction.RESTORE
    }
    return AuditAction.UPDATE
}

// ─── Extensão ────────────────────────────────────────────────────────────────

export function auditExtension(base: PrismaClient) {
    interface ReadDelegate {
        findUnique(args: { where: unknown }): Promise<unknown>
        findMany(args: { where?: unknown }): Promise<Row[]>
    }
    const delegateOf = (meta: ModelMeta) =>
        (base as unknown as Record<string, ReadDelegate>)[meta.delegate]

    function buildEntry(
        model: string,
        action: AuditAction,
        entityId: string,
        before: Row | null,
        after: Row | null,
        changes: Record<string, { from: unknown; to: unknown }> | null,
    ): AuditEntry {
        const ctx = getAuditContext()
        return {
            companyId: (after?.companyId as string) ?? (before?.companyId as string) ?? ctx?.companyId ?? null,
            userId: ctx?.userId ?? null,
            userEmail: ctx?.userEmail ?? null,
            action,
            entity: model,
            entityId,
            changes: changes && Object.keys(changes).length ? changes : null,
            before,
            after,
            ipAddress: ctx?.ipAddress ?? null,
            userAgent: ctx?.userAgent ?? null,
            requestId: ctx?.requestId ?? null,
            method: ctx?.method ?? null,
        }
    }

    function record(entries: AuditEntry[]) {
        if (!entries.length) return
        const ctx = getAuditContext()
        if (ctx && !ctx.flushed) {
            ctx.buffer.push(...entries)
            return
        }
        void writeAuditEntries(base, entries)
    }

    async function safe<T>(fn: () => T | Promise<T>): Promise<T | null> {
        try {
            return await fn()
        } catch (err) {
            logger.error(`Falha ao preparar auditoria: ${(err as Error).message}`)
            return null
        }
    }

    return Prisma.defineExtension({
        name: 'audit',
        query: {
            $allModels: {
                async create({ model, args, query }) {
                    const result = await query(args)
                    const meta = modelMeta.get(model)
                    if (!meta || AUDIT_EXCLUDED.has(model)) return result
                    await safe(() => {
                        const after = mergeResult(meta, applyData(meta, null, args.data), result)
                        record([buildEntry(model, AuditAction.CREATE, entityIdOf(meta, after), null, after, null)])
                    })
                    return result
                },

                async createMany({ model, args, query }) {
                    const result = await query(args)
                    const meta = modelMeta.get(model)
                    if (!meta || AUDIT_EXCLUDED.has(model)) return result
                    await safe(() => {
                        const items = Array.isArray(args.data) ? args.data : [args.data]
                        record(items.map((d) => {
                            const after = applyData(meta, null, d)
                            return buildEntry(model, AuditAction.CREATE, entityIdOf(meta, after), null, after, null)
                        }))
                    })
                    return result
                },

                async update({ model, args, query }) {
                    const meta = modelMeta.get(model)
                    if (!meta || AUDIT_EXCLUDED.has(model)) return query(args)
                    const before = await safe(async () => snapshot(meta, await delegateOf(meta).findUnique({ where: args.where })))
                    const result = await query(args)
                    await safe(() => {
                        const after = mergeResult(meta, applyData(meta, before, args.data), result)
                        const changes = { ...diff(before, after), ...changedSensitive(meta, args.data) }
                        if (!Object.keys(changes).length) return
                        record([buildEntry(model, classifyUpdate(before, after), entityIdOf(meta, after, args.where), before, after, changes)])
                    })
                    return result
                },

                async upsert({ model, args, query }) {
                    const meta = modelMeta.get(model)
                    if (!meta || AUDIT_EXCLUDED.has(model)) return query(args)
                    const before = await safe(async () => snapshot(meta, await delegateOf(meta).findUnique({ where: args.where })))
                    const result = await query(args)
                    await safe(() => {
                        if (!before) {
                            const after = mergeResult(meta, applyData(meta, null, args.create), result)
                            record([buildEntry(model, AuditAction.CREATE, entityIdOf(meta, after, args.where), null, after, null)])
                            return
                        }
                        const after = mergeResult(meta, applyData(meta, before, args.update), result)
                        const changes = { ...diff(before, after), ...changedSensitive(meta, args.update) }
                        if (!Object.keys(changes).length) return
                        record([buildEntry(model, classifyUpdate(before, after), entityIdOf(meta, after, args.where), before, after, changes)])
                    })
                    return result
                },

                async updateMany({ model, args, query }) {
                    const meta = modelMeta.get(model)
                    if (!meta || AUDIT_EXCLUDED.has(model)) return query(args)
                    const rows = await safe(async () => delegateOf(meta).findMany({ where: args.where }))
                    const result = await query(args)
                    await safe(() => {
                        const entries: AuditEntry[] = []
                        for (const row of rows ?? []) {
                            const before = snapshot(meta, row)
                            const after = applyData(meta, before, args.data)
                            const changes = { ...diff(before, after), ...changedSensitive(meta, args.data) }
                            if (!Object.keys(changes).length) continue
                            entries.push(buildEntry(model, classifyUpdate(before, after), entityIdOf(meta, before), before, after, changes))
                        }
                        record(entries)
                    })
                    return result
                },

                async delete({ model, args, query }) {
                    const meta = modelMeta.get(model)
                    if (!meta || AUDIT_EXCLUDED.has(model)) return query(args)
                    const before = await safe(async () => snapshot(meta, await delegateOf(meta).findUnique({ where: args.where })))
                    const result = await query(args)
                    await safe(() => {
                        const snap = before ?? snapshot(meta, result)
                        record([buildEntry(model, AuditAction.DELETE, entityIdOf(meta, snap, args.where), snap, null, null)])
                    })
                    return result
                },

                async deleteMany({ model, args, query }) {
                    const meta = modelMeta.get(model)
                    if (!meta || AUDIT_EXCLUDED.has(model)) return query(args)
                    const rows = await safe(async () => delegateOf(meta).findMany({ where: args.where }))
                    const result = await query(args)
                    await safe(() => {
                        record((rows ?? []).map((row) => {
                            const before = snapshot(meta, row)
                            return buildEntry(model, AuditAction.DELETE, entityIdOf(meta, before), before, null, null)
                        }))
                    })
                    return result
                },
            },
        },
    })
}

/** Grava logs de auditoria. Nunca lança erro — auditoria não pode derrubar a operação. */
export async function writeAuditEntries(base: PrismaClient, entries: AuditEntry[]): Promise<void> {
    if (!entries.length) return
    try {
        await base.auditLog.createMany({
            data: entries.map((e) => ({
                ...e,
                changes: (e.changes ?? Prisma.DbNull) as Prisma.InputJsonValue,
                before: (e.before ?? Prisma.DbNull) as Prisma.InputJsonValue,
                after: (e.after ?? Prisma.DbNull) as Prisma.InputJsonValue,
            })),
        })
    } catch (err) {
        logger.error(`Falha ao gravar ${entries.length} log(s) de auditoria: ${(err as Error).message}`)
    }
}
