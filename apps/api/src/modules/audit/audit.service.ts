import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ListAuditLogsDto } from './dto/list-audit-logs.dto'

const LOG_SELECT = {
    id: true,
    companyId: true,
    userId: true,
    userEmail: true,
    action: true,
    entity: true,
    entityId: true,
    changes: true,
    before: true,
    after: true,
    ipAddress: true,
    userAgent: true,
    requestId: true,
    method: true,
    createdAt: true,
    user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditLogSelect

type LogRow = Prisma.AuditLogGetPayload<{ select: typeof LOG_SELECT }>
type Snapshot = Record<string, unknown>

// ─── Identificação legível do registro auditado ───────────────────────────────

interface EquipmentRef {
    id: string
    name: string | null
    patrimonyNumber: string | null
}

export type AuditSubject =
    | { type: 'Equipment'; id: string; name: string | null; patrimonyNumber: string | null }
    | {
        type: 'ServiceOrder'
        id: string
        number: number | null
        title: string | null
        equipment: EquipmentRef | null
    }

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && !isNaN(+v) ? +v : null)

/** Estado do registro no momento do log (depois da ação; em exclusões, o anterior). */
const snapshotOf = (log: LogRow): Snapshot => ({
    ...((log.before as Snapshot | null) ?? {}),
    ...((log.after as Snapshot | null) ?? {}),
})

@Injectable()
export class AuditService {
    constructor(private readonly prisma: PrismaService) { }

    async list(filters: ListAuditLogsDto) {
        const page = filters.page ?? 1
        const limit = filters.limit ?? 50

        const where: Prisma.AuditLogWhereInput = {}
        if (filters.entity) where.entity = filters.entity
        if (filters.entityId) where.entityId = filters.entityId
        if (filters.action) where.action = filters.action
        if (filters.userId) where.userId = filters.userId
        if (filters.companyId) where.companyId = filters.companyId
        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {
                ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
                ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
            }
        }
        if (filters.search) where.OR = this.searchConditions(filters.search.trim())

        const [rows, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
                select: LOG_SELECT,
            }),
            this.prisma.auditLog.count({ where }),
        ])

        const totalPages = Math.ceil(total / limit)
        return {
            data: await this.enrich(rows),
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        }
    }

    /** Histórico completo de um registro (ex.: quem criou/alterou/deletou o equipamento X). */
    async history(entity: string, entityId: string) {
        const rows = await this.prisma.auditLog.findMany({
            where: { entity, entityId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 500,
            select: LOG_SELECT,
        })
        return this.enrich(rows)
    }

    /** Entidades que já têm registros — usado no filtro da tela. */
    async entities() {
        const rows = await this.prisma.auditLog.groupBy({
            by: ['entity'],
            _count: { _all: true },
            orderBy: { entity: 'asc' },
        })
        return rows.map((r) => ({ entity: r.entity, count: r._count._all }))
    }

    /**
     * Busca por e-mail, ID, rota e também pelo que o usuário enxerga na tela:
     * nome/patrimônio do equipamento e número/título da OS (gravados no snapshot).
     */
    private searchConditions(search: string): Prisma.AuditLogWhereInput[] {
        const conditions: Prisma.AuditLogWhereInput[] = [
            { userEmail: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search } },
            { method: { contains: search, mode: 'insensitive' } },
        ]
        for (const snap of ['after', 'before'] as const) {
            for (const field of ['name', 'patrimonyNumber', 'title']) {
                conditions.push({ [snap]: { path: [field], string_contains: search } })
            }
        }
        // "123", "OS 123", "#123", "OS nº 123" → número da OS
        const osNumber = /^(?:os\s*)?(?:n[º°o.]?\s*)?#?\s*(\d+)$/i.exec(search)?.[1]
        if (osNumber) {
            for (const snap of ['after', 'before'] as const) {
                conditions.push({ entity: 'ServiceOrder', [snap]: { path: ['number'], equals: Number(osNumber) } })
            }
        }
        return conditions
    }

    /** Acrescenta empresa e a identificação legível (subject) de cada log. */
    private async enrich(rows: LogRow[]) {
        const db = this.prisma.unfiltered // enxerga registros já excluídos

        const companyIds = [...new Set(rows.map((r) => r.companyId).filter((id): id is string => !!id))]
        const equipmentIds = new Set<string>()
        const serviceOrderIds = new Set<string>()
        for (const r of rows) {
            if (r.entity === 'Equipment') equipmentIds.add(r.entityId)
            if (r.entity === 'ServiceOrder') {
                serviceOrderIds.add(r.entityId)
                const eqId = str(snapshotOf(r).equipmentId)
                if (eqId) equipmentIds.add(eqId)
            }
        }

        // OS sem snapshot completo: busca no banco (e o equipamento dela)
        const serviceOrders = serviceOrderIds.size
            ? await db.serviceOrder.findMany({
                where: { id: { in: [...serviceOrderIds] } },
                select: { id: true, number: true, title: true, equipmentId: true },
            })
            : []
        for (const so of serviceOrders) if (so.equipmentId) equipmentIds.add(so.equipmentId)

        const [companies, equipments]: [
            Array<{ id: string; name: string }>,
            Array<{ id: string; name: string; patrimonyNumber: string | null }>,
        ] = await Promise.all([
            companyIds.length
                ? db.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
                : Promise.resolve([]),
            equipmentIds.size
                ? db.equipment.findMany({
                    where: { id: { in: [...equipmentIds] } },
                    select: { id: true, name: true, patrimonyNumber: true },
                })
                : Promise.resolve([]),
        ])

        const companyById = new Map(companies.map((c) => [c.id, c]))
        const equipmentById = new Map(equipments.map((e) => [e.id, e]))
        const soById = new Map(serviceOrders.map((so) => [so.id, so]))

        const equipmentRef = (id: string | null): EquipmentRef | null => {
            if (!id) return null
            const e = equipmentById.get(id)
            return { id, name: e?.name ?? null, patrimonyNumber: e?.patrimonyNumber ?? null }
        }

        const subjectOf = (r: LogRow): AuditSubject | null => {
            const snap = snapshotOf(r)
            if (r.entity === 'Equipment') {
                // O snapshot mostra o nome/patrimônio da época do log; o banco é fallback
                const stored = equipmentById.get(r.entityId)
                return {
                    type: 'Equipment',
                    id: r.entityId,
                    name: str(snap.name) ?? stored?.name ?? null,
                    patrimonyNumber: str(snap.patrimonyNumber) ?? stored?.patrimonyNumber ?? null,
                }
            }
            if (r.entity === 'ServiceOrder') {
                const stored = soById.get(r.entityId)
                return {
                    type: 'ServiceOrder',
                    id: r.entityId,
                    number: num(snap.number) ?? stored?.number ?? null,
                    title: str(snap.title) ?? stored?.title ?? null,
                    equipment: equipmentRef(str(snap.equipmentId) ?? stored?.equipmentId ?? null),
                }
            }
            return null
        }

        return rows.map((r) => ({
            ...r,
            company: r.companyId ? companyById.get(r.companyId) ?? null : null,
            subject: subjectOf(r),
        }))
    }
}
