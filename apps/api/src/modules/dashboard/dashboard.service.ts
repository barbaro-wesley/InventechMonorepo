import { Injectable, Inject } from '@nestjs/common'
import { ServiceOrderStatus, ServiceOrderPriority, CompanyStatus } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../common/providers/redis.provider'

const DASHBOARD_TTL = 300      // 5 minutos — dashboard de empresa/cliente
const SUPERADMIN_TTL = 600     // 10 minutos — dashboard do super admin

@Injectable()
export class DashboardService {
    constructor(
        private prisma: PrismaService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) { }

    private async getCached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
        try {
            const cached = await this.redis.get(key)
            if (cached) return JSON.parse(cached) as T
        } catch {
            // Redis indisponível — executa query normalmente
        }

        const result = await fn()

        try {
            await this.redis.setex(key, ttl, JSON.stringify(result))
        } catch {
            // Não crítico
        }

        return result
    }

    // ─────────────────────────────────────────
    // Dashboard principal — tudo em paralelo
    // ─────────────────────────────────────────
    async getCompanyDashboard(companyId: string) {
        return this.getCached(`dashboard:company:${companyId}`, DASHBOARD_TTL, async () => {
            const [
                osMetrics,
                osTimeline,
                topTechnicians,
                equipmentMetrics,
                groupMetrics,
                alerts,
            ] = await Promise.all([
                this.getOsMetrics(companyId),
                this.getOsTimeline(companyId),
                this.getTopTechnicians(companyId),
                this.getEquipmentMetrics(companyId),
                this.getGroupMetrics(companyId),
                this.getAlerts(companyId),
            ])

            return {
                osMetrics,
                osTimeline,
                topTechnicians,
                equipmentMetrics,
                groupMetrics,
                alerts,
                generatedAt: new Date().toISOString(),
            }
        })
    }

    // ─────────────────────────────────────────
    // Dashboard do cliente — visão restrita
    // ─────────────────────────────────────────
    async getClientDashboard(companyId: string, clientId: string) {
        return this.getCached(`dashboard:client:${companyId}:${clientId}`, DASHBOARD_TTL, async () => {
            const [osMetrics, equipmentMetrics, recentOs] = await Promise.all([
                this.getOsMetrics(companyId, clientId),
                this.getEquipmentMetrics(companyId),
                this.getRecentOs(companyId, clientId),
            ])

            return {
                osMetrics,
                equipmentMetrics,
                recentOs,
                generatedAt: new Date().toISOString(),
            }
        })
    }

    // ─────────────────────────────────────────
    // Contadores de OS por status
    // ─────────────────────────────────────────
    private async getOsMetrics(companyId: string, clientId?: string) {
        const where = { companyId, ...(clientId && { clientId }), deletedAt: null }

        const [
            total,
            open,
            awaitingPickup,
            inProgress,
            completed,
            approved,
            rejected,
            cancelled,
            urgent,
            avgResolutionHours,
        ] = await Promise.all([
            this.prisma.serviceOrder.count({ where }),
            this.prisma.serviceOrder.count({ where: { ...where, status: ServiceOrderStatus.OPEN } }),
            this.prisma.serviceOrder.count({ where: { ...where, status: ServiceOrderStatus.AWAITING_PICKUP } }),
            this.prisma.serviceOrder.count({ where: { ...where, status: ServiceOrderStatus.IN_PROGRESS } }),
            this.prisma.serviceOrder.count({ where: { ...where, status: ServiceOrderStatus.COMPLETED } }),
            this.prisma.serviceOrder.count({ where: { ...where, status: ServiceOrderStatus.COMPLETED_APPROVED } }),
            this.prisma.serviceOrder.count({ where: { ...where, status: ServiceOrderStatus.COMPLETED_REJECTED } }),
            this.prisma.serviceOrder.count({ where: { ...where, status: ServiceOrderStatus.CANCELLED } }),
            this.prisma.serviceOrder.count({ where: { ...where, priority: ServiceOrderPriority.URGENT, status: { notIn: ['COMPLETED_APPROVED', 'CANCELLED'] } } }),
            // Tempo médio de resolução em horas (últimos 30 dias)
            this.prisma.$queryRaw<[{ avg_hours: number }]>`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600)::numeric, 1) as avg_hours
        FROM service_orders
        WHERE company_id = ${companyId}
          ${clientId ? this.prisma.$queryRaw`AND client_id = ${clientId}` : this.prisma.$queryRaw``}
          AND status IN ('COMPLETED', 'COMPLETED_APPROVED')
          AND completed_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
          AND deleted_at IS NULL
      `.catch(() => [{ avg_hours: null }]),
        ])

        const activeOs = open + awaitingPickup + inProgress + completed

        return {
            total,
            active: activeOs,
            byStatus: {
                open,
                awaitingPickup,
                inProgress,
                completed,
                approved,
                rejected,
                cancelled,
            },
            urgent,
            avgResolutionHours: avgResolutionHours[0]?.avg_hours ?? null,
        }
    }

    // ─────────────────────────────────────────
    // OS criadas por dia — últimos 30 dias
    // ─────────────────────────────────────────
    private async getOsTimeline(companyId: string) {
        const result = await this.prisma.$queryRaw<
            Array<{ date: string; total: number; completed: number }>
        >`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') as date,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'COMPLETED_APPROVED'))::int as completed
      FROM service_orders
      WHERE company_id = ${companyId}
        AND created_at >= NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `

        return result
    }

    // ─────────────────────────────────────────
    // Top 5 técnicos por OS concluídas (30 dias)
    // ─────────────────────────────────────────
    private async getTopTechnicians(companyId: string) {
        const result = await this.prisma.$queryRaw<
            Array<{
                technician_id: string
                name: string
                total_os: number
                completed_os: number
                avg_hours: number | null
            }>
        >`
      SELECT
        u.id as technician_id,
        u.name,
        COUNT(DISTINCT sot.service_order_id)::int as total_os,
        COUNT(DISTINCT CASE WHEN so.status IN ('COMPLETED', 'COMPLETED_APPROVED')
          THEN sot.service_order_id END)::int as completed_os,
        ROUND(AVG(
          CASE WHEN so.completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (so.completed_at - so.created_at)) / 3600
          END
        )::numeric, 1) as avg_hours
      FROM service_order_technicians sot
      JOIN users u ON u.id = sot.technician_id
      JOIN service_orders so ON so.id = sot.service_order_id
      WHERE so.company_id = ${companyId}
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.deleted_at IS NULL
      GROUP BY u.id, u.name
      ORDER BY completed_os DESC, total_os DESC
      LIMIT 5
    `

        return result
    }

    // ─────────────────────────────────────────
    // Métricas de equipamentos
    // ─────────────────────────────────────────
    private async getEquipmentMetrics(companyId: string) {
        const where = { companyId, deletedAt: null }

        const [total, active, underMaintenance, inactive, scrapped, critical, types, withoutType] =
            await Promise.all([
                this.prisma.equipment.count({ where }),
                this.prisma.equipment.count({ where: { ...where, status: 'ACTIVE' } }),
                this.prisma.equipment.count({ where: { ...where, status: 'UNDER_MAINTENANCE' } }),
                this.prisma.equipment.count({ where: { ...where, status: 'INACTIVE' } }),
                this.prisma.equipment.count({ where: { ...where, status: 'SCRAPPED' } }),
                this.prisma.equipment.count({ where: { ...where, criticality: 'CRITICAL' } }),
                this.prisma.equipmentType.findMany({
                    where: { companyId, isActive: true },
                    select: { id: true, name: true, _count: { select: { equipments: true } } },
                    orderBy: { name: 'asc' },
                }),
                this.prisma.equipment.count({ where: { ...where, typeId: null } }),
            ])

        const byTypeItems = types
            .filter((t) => t._count.equipments > 0)
            .map((t) => ({ id: t.id, name: t.name, count: t._count.equipments }))
        if (withoutType > 0) byTypeItems.push({ id: 'none', name: 'Sem tipo', count: withoutType })

        return {
            total,
            byStatus: { active, underMaintenance, inactive, scrapped },
            byType: byTypeItems,
            critical,
            availabilityRate: total > 0
                ? Math.round((active / total) * 100)
                : 100,
        }
    }

    // ─────────────────────────────────────────
    // OS por grupo de manutenção
    // ─────────────────────────────────────────
    private async getGroupMetrics(companyId: string) {
        const result = await this.prisma.$queryRaw<
            Array<{
                group_id: string
                group_name: string
                color: string
                total_os: number
                open_os: number
                in_progress_os: number
            }>
        >`
      SELECT
        mg.id as group_id,
        mg.name as group_name,
        COALESCE(mg.color, '#888888') as color,
        COUNT(so.id)::int as total_os,
        COUNT(so.id) FILTER (
          WHERE so.status IN ('OPEN', 'AWAITING_PICKUP')
        )::int as open_os,
        COUNT(so.id) FILTER (
          WHERE so.status = 'IN_PROGRESS'
        )::int as in_progress_os
      FROM maintenance_groups mg
      LEFT JOIN service_orders so
        ON so.group_id = mg.id
        AND so.deleted_at IS NULL
        AND so.created_at >= NOW() - INTERVAL '30 days'
      WHERE mg.company_id = ${companyId}
        AND mg.is_active = true
      GROUP BY mg.id, mg.name, mg.color
      ORDER BY total_os DESC
    `

        return result
    }

    // ─────────────────────────────────────────
    // Alertas ativos
    // ─────────────────────────────────────────
    private async getAlerts(companyId: string) {
        const [unassignedOs, overdueAlerts, equipmentUnderMaintenance, warrantyExpiring] =
            await Promise.all([
                // OS no painel sem técnico
                this.prisma.serviceOrder.count({
                    where: {
                        companyId,
                        isAvailable: true,
                        status: ServiceOrderStatus.AWAITING_PICKUP,
                        deletedAt: null,
                    },
                }),
                // OS com alerta de atraso já enviado
                this.prisma.serviceOrder.count({
                    where: {
                        companyId,
                        alertSentAt: { not: null },
                        isAvailable: true,
                        deletedAt: null,
                    },
                }),
                // Equipamentos em manutenção
                this.prisma.equipment.count({
                    where: { companyId, status: 'UNDER_MAINTENANCE', deletedAt: null },
                }),
                // Equipamentos com garantia vencendo em 30 dias
                this.prisma.equipment.count({
                    where: {
                        companyId,
                        deletedAt: null,
                        warrantyEnd: {
                            gte: new Date(),
                            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                }),
            ])

        return {
            unassignedOs,
            overdueAlerts,
            equipmentUnderMaintenance,
            warrantyExpiring,
            total: unassignedOs + overdueAlerts,
        }
    }

    // ─────────────────────────────────────────
    // Dashboard plataforma — visão do SUPER_ADMIN
    // ─────────────────────────────────────────
    async getSuperAdminDashboard() {
        return this.getCached('dashboard:superadmin', SUPERADMIN_TTL, async () => {
            const [
                companyMetrics,
                userMetrics,
                clientMetrics,
                equipmentTotal,
                osMetrics,
                licenseAlerts,
                recentCompanies,
            ] = await Promise.all([
                this.getPlatformCompanyMetrics(),
                this.getPlatformUserMetrics(),
                this.getPlatformClientMetrics(),
                this.prisma.equipment.count({ where: { deletedAt: null } }),
                this.getPlatformOsMetrics(),
                this.getExpiringLicenses(),
                this.getRecentCompanies(),
            ])

            return {
                companyMetrics,
                userMetrics,
                clientMetrics,
                equipmentTotal,
                osMetrics,
                licenseAlerts,
                recentCompanies,
                generatedAt: new Date().toISOString(),
            }
        })
    }

    private async getPlatformCompanyMetrics() {
        const [total, active, trial, suspended, inactive] = await Promise.all([
            this.prisma.company.count({ where: { deletedAt: null } }),
            this.prisma.company.count({ where: { deletedAt: null, status: CompanyStatus.ACTIVE } }),
            this.prisma.company.count({ where: { deletedAt: null, status: CompanyStatus.TRIAL } }),
            this.prisma.company.count({ where: { deletedAt: null, status: CompanyStatus.SUSPENDED } }),
            this.prisma.company.count({ where: { deletedAt: null, status: CompanyStatus.INACTIVE } }),
        ])
        return { total, byStatus: { active, trial, suspended, inactive } }
    }

    private async getPlatformUserMetrics() {
        const [total, active, unverified, blocked] = await Promise.all([
            this.prisma.user.count({ where: { deletedAt: null } }),
            this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
            this.prisma.user.count({ where: { deletedAt: null, status: 'UNVERIFIED' } }),
            this.prisma.user.count({ where: { deletedAt: null, status: 'BLOCKED' } }),
        ])
        return { total, active, unverified, blocked }
    }

    private async getPlatformClientMetrics() {
        const [total, active] = await Promise.all([
            this.prisma.client.count({ where: { deletedAt: null } }),
            this.prisma.client.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
        ])
        return { total, active }
    }

    private async getPlatformOsMetrics() {
        const [total, open, inProgress, urgent] = await Promise.all([
            this.prisma.serviceOrder.count({ where: { deletedAt: null } }),
            this.prisma.serviceOrder.count({ where: { deletedAt: null, status: ServiceOrderStatus.OPEN } }),
            this.prisma.serviceOrder.count({ where: { deletedAt: null, status: ServiceOrderStatus.IN_PROGRESS } }),
            this.prisma.serviceOrder.count({
                where: {
                    deletedAt: null,
                    priority: ServiceOrderPriority.URGENT,
                    status: { notIn: ['COMPLETED_APPROVED', 'CANCELLED'] },
                },
            }),
        ])
        return { total, open, inProgress, urgent, active: open + inProgress }
    }

    private async getExpiringLicenses() {
        const now = new Date()
        const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        return this.prisma.company.findMany({
            where: {
                deletedAt: null,
                status: { in: [CompanyStatus.ACTIVE, CompanyStatus.TRIAL] },
                trialEndsAt: { gte: now, lte: in30Days },
            },
            select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                trialEndsAt: true,
                _count: { select: { users: true } },
            },
            orderBy: { trialEndsAt: 'asc' },
            take: 5,
        })
    }

    private async getRecentCompanies() {
        return this.prisma.company.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                createdAt: true,
                _count: { select: { users: true, clients: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
        })
    }

    // ─────────────────────────────────────────
    // OS recentes — para visão do cliente
    // ─────────────────────────────────────────
    private async getRecentOs(companyId: string, clientId: string) {
        return this.prisma.serviceOrder.findMany({
            where: { companyId, clientId, deletedAt: null },
            select: {
                id: true,
                number: true,
                title: true,
                status: true,
                priority: true,
                maintenanceType: true,
                createdAt: true,
                equipment: { select: { id: true, name: true } },
                group: { select: { id: true, name: true, color: true } },
                technicians: {
                    where: { releasedAt: null },
                    select: { technician: { select: { id: true, name: true } } },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        })
    }
}