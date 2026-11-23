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
        if (filters.search) {
            where.OR = [
                { userEmail: { contains: filters.search, mode: 'insensitive' } },
                { entityId: { contains: filters.search } },
                { method: { contains: filters.search, mode: 'insensitive' } },
            ]
        }

        const [rows, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: LOG_SELECT,
            }),
            this.prisma.auditLog.count({ where }),
        ])

        const totalPages = Math.ceil(total / limit)
        return {
            data: await this.withCompanies(rows),
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
            orderBy: { createdAt: 'desc' },
            take: 500,
            select: LOG_SELECT,
        })
        return this.withCompanies(rows)
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

    private async withCompanies<T extends { companyId: string | null }>(rows: T[]) {
        const ids = [...new Set(rows.map((r) => r.companyId).filter((id): id is string => !!id))]
        const companies = ids.length
            ? await this.prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
            : []
        const byId = new Map(companies.map((c) => [c.id, c]))
        return rows.map((r) => ({ ...r, company: r.companyId ? byId.get(r.companyId) ?? null : null }))
    }
}
