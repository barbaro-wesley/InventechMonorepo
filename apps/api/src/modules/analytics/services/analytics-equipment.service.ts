import { Injectable, Inject } from '@nestjs/common'
import { Prisma, EquipmentStatus } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../../common/providers/redis.provider'
import { resolvePeriod } from '../analytics-period.util'
import type {
  EquipmentOverviewQueryDto,
  EquipmentRangeQueryDto,
  EquipmentCostsQueryDto,
  EquipmentWarrantyQueryDto,
} from '../dto/analytics-equipment-query.dto'

const TTL = 300

@Injectable()
export class AnalyticsEquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.redis.get(key)
      if (hit) return JSON.parse(hit) as T
    } catch { /* Redis indisponível */ }

    const result = await fn()

    try {
      await this.redis.setex(key, TTL, JSON.stringify(result))
    } catch { /* Não crítico */ }

    return result
  }

  // ─────────────────────────────────────────
  // Visão geral do parque de equipamentos
  // ─────────────────────────────────────────
  async getOverview(companyId: string, filters: EquipmentOverviewQueryDto) {
    const cacheKey = `analytics:equip:overview:${companyId}:${filters.typeId ?? ''}:${filters.locationId ?? ''}:${filters.costCenterId ?? ''}`

    return this.cached(cacheKey, async () => {
      const baseWhere = {
        companyId,
        deletedAt: null,
        ...(filters.typeId && { typeId: filters.typeId }),
        ...(filters.locationId && { currentLocationId: filters.locationId }),
        ...(filters.costCenterId && { costCenterId: filters.costCenterId }),
      }

      const now = new Date()
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

      const [
        statusGroups,
        criticalityGroups,
        financials,
        warrantyExpired,
        warrantyExpiringSoon30,
        warrantyExpiringSoon90,
        withoutSchedule,
      ] = await Promise.all([
        this.prisma.equipment.groupBy({
          by: ['status'],
          where: baseWhere,
          _count: { id: true },
        }),
        this.prisma.equipment.groupBy({
          by: ['criticality'],
          where: baseWhere,
          _count: { id: true },
        }),
        this.prisma.equipment.aggregate({
          where: baseWhere,
          _sum: { purchaseValue: true, currentValue: true },
          _count: { id: true },
        }),
        this.prisma.equipment.count({
          where: { ...baseWhere, warrantyEnd: { not: null, lt: now } },
        }),
        this.prisma.equipment.count({
          where: { ...baseWhere, warrantyEnd: { gte: now, lte: in30Days } },
        }),
        this.prisma.equipment.count({
          where: { ...baseWhere, warrantyEnd: { gte: now, lte: in90Days } },
        }),
        this.prisma.equipment.count({
          where: { ...baseWhere, schedules: { none: { isActive: true } } },
        }),
      ])

      const total = financials._count.id
      const statusMap = Object.fromEntries(statusGroups.map(g => [g.status, g._count.id]))
      const critMap = Object.fromEntries(criticalityGroups.map(g => [g.criticality, g._count.id]))
      const active = statusMap['ACTIVE'] ?? 0

      const totalPurchase = Number(financials._sum.purchaseValue ?? 0)
      const totalCurrent = Number(financials._sum.currentValue ?? 0)
      const depreciationPercent = totalPurchase > 0
        ? Math.round(((totalPurchase - totalCurrent) / totalPurchase) * 100)
        : 0

      return {
        total,
        byStatus: {
          active,
          underMaintenance: statusMap['UNDER_MAINTENANCE'] ?? 0,
          inactive:         statusMap['INACTIVE'] ?? 0,
          scrapped:         statusMap['SCRAPPED'] ?? 0,
          borrowed:         statusMap['BORROWED'] ?? 0,
        },
        byCriticality: {
          low:      critMap['LOW'] ?? 0,
          medium:   critMap['MEDIUM'] ?? 0,
          high:     critMap['HIGH'] ?? 0,
          critical: critMap['CRITICAL'] ?? 0,
        },
        availabilityRate: total > 0 ? Math.round((active / total) * 100) : 100,
        financials: {
          totalPurchaseValue:  totalPurchase,
          totalCurrentValue:   totalCurrent,
          depreciationPercent,
        },
        warranty: {
          expired:          warrantyExpired,
          expiringSoon30:   warrantyExpiringSoon30,
          expiringSoon90:   warrantyExpiringSoon90,
        },
        withoutActiveSchedule: withoutSchedule,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Top N equipamentos com mais falhas
  // Retorna OS count, MTTR e custo por equipamento
  // ─────────────────────────────────────────
  async getTopFailures(companyId: string, filters: EquipmentRangeQueryDto) {
    const limit = filters.limit ?? 10
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)

    const cacheKey = `analytics:equip:failures:${companyId}:${start.toISOString()}:${end.toISOString()}:${filters.typeId ?? ''}:${filters.locationId ?? ''}:${limit}`

    return this.cached(cacheKey, async () => {
      const typeF = filters.typeId       ? Prisma.sql`AND e.type_id              = ${filters.typeId}::uuid`       : Prisma.empty
      const locF  = filters.locationId   ? Prisma.sql`AND e.current_location_id  = ${filters.locationId}::uuid`   : Prisma.empty
      const ccF   = filters.costCenterId ? Prisma.sql`AND e.cost_center_id       = ${filters.costCenterId}::uuid` : Prisma.empty

      const [items, [globalRow]] = await Promise.all([
        this.prisma.$queryRaw<Array<{
          id:               string
          name:             string
          brand:            string | null
          model:            string | null
          serial_number:    string | null
          patrimony_number: string | null
          status:           string
          criticality:      string
          type_name:        string | null
          location_name:    string | null
          total_os:         number
          completed_os:     number
          mttr_hours:       number | null
          total_cost:       number
        }>>`
          SELECT
            e.id,
            e.name,
            e.brand,
            e.model,
            e.serial_number,
            e.patrimony_number,
            e.status,
            e.criticality,
            et.name                                                                 AS type_name,
            l.name                                                                  AS location_name,
            COUNT(DISTINCT so.id)::int                                              AS total_os,
            COUNT(DISTINCT so.id) FILTER (
              WHERE so.status IN ('COMPLETED', 'COMPLETED_APPROVED')
            )::int                                                                  AS completed_os,
            ROUND(AVG(
              CASE WHEN so.completed_at IS NOT NULL AND so.started_at IS NOT NULL
                   THEN EXTRACT(EPOCH FROM (so.completed_at - so.started_at)) / 3600.0
              END
            )::numeric, 1)::float8                                                  AS mttr_hours,
            COALESCE(SUM(ci.total), 0)::float8                                      AS total_cost
          FROM equipments e
          LEFT JOIN equipment_types            et   ON et.id  = e.type_id
          LEFT JOIN locations                  l    ON l.id   = e.current_location_id
          LEFT JOIN service_orders             so
            ON  so.equipment_id = e.id
            AND so.deleted_at   IS NULL
            AND so.created_at  >= ${start}
            AND so.created_at  <= ${end}
          -- Custo agregado por OS antes do join: juntar os itens direto
          -- duplicava a linha da OS e distorcia o MTTR médio.
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(soci.total_price), 0) AS total
            FROM service_order_cost_items soci
            WHERE soci.service_order_id = so.id
          ) ci ON TRUE
          WHERE e.company_id  = ${companyId}
            AND e.deleted_at  IS NULL
            ${typeF}
            ${locF}
            ${ccF}
          GROUP BY e.id, e.name, e.brand, e.model, e.serial_number, e.patrimony_number,
                   e.status, e.criticality, et.name, l.name
          ORDER BY total_os DESC, total_cost DESC
          LIMIT ${limit}
        `,

        this.prisma.$queryRaw<[{ global_mttr: number | null }]>`
          SELECT ROUND(AVG(
            CASE WHEN so.completed_at IS NOT NULL AND so.started_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (so.completed_at - so.started_at)) / 3600.0
            END
          )::numeric, 1)::float8 AS global_mttr
          FROM service_orders so
          JOIN equipments e ON e.id = so.equipment_id
          WHERE so.company_id = ${companyId}
            AND so.deleted_at IS NULL
            AND so.created_at >= ${start}
            AND so.created_at <= ${end}
            ${typeF}
            ${locF}
            ${ccF}
        `,
      ])

      return {
        period:         { start: start.toISOString(), end: end.toISOString() },
        globalMttrHours: globalRow?.global_mttr ?? null,
        items,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Custo de manutenção — por tipo de item
  // e agrupado por equipment / type / location / costCenter
  // ─────────────────────────────────────────
  async getCosts(companyId: string, filters: EquipmentCostsQueryDto) {
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)
    const groupBy = filters.groupBy ?? 'equipment'
    const limit   = filters.limit ?? 20

    const cacheKey = `analytics:equip:costs:${companyId}:${start.toISOString()}:${end.toISOString()}:${groupBy}:${filters.typeId ?? ''}:${limit}`

    return this.cached(cacheKey, async () => {
      const typeF = filters.typeId       ? Prisma.sql`AND e.type_id              = ${filters.typeId}::uuid`       : Prisma.empty
      const locF  = filters.locationId   ? Prisma.sql`AND e.current_location_id  = ${filters.locationId}::uuid`   : Prisma.empty
      const ccF   = filters.costCenterId ? Prisma.sql`AND e.cost_center_id       = ${filters.costCenterId}::uuid` : Prisma.empty

      const byItemType = await this.prisma.$queryRaw<Array<{
        type:       string
        total:      number
        item_count: number
      }>>`
        SELECT
          soci.type,
          SUM(soci.total_price)::float8 AS total,
          COUNT(soci.id)::int           AS item_count
        FROM service_order_cost_items soci
        JOIN service_orders so ON so.id = soci.service_order_id
        JOIN equipments     e  ON e.id  = so.equipment_id
        WHERE so.company_id     = ${companyId}
          AND so.deleted_at    IS NULL
          AND so.created_at    >= ${start}
          AND so.created_at    <= ${end}
          AND so.equipment_id  IS NOT NULL
          ${typeF}
          ${locF}
          ${ccF}
        GROUP BY soci.type
        ORDER BY total DESC
      `

      const totalCost = byItemType.reduce((sum, r) => sum + r.total, 0)

      type BreakdownRow = { id: string | null; name: string; totalCost: number; osCount: number }
      let breakdown: BreakdownRow[] = []

      if (groupBy === 'equipment') {
        const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string; total_cost: number; os_count: number }>>`
          SELECT
            e.id,
            e.name,
            COALESCE(SUM(soci.total_price), 0)::float8 AS total_cost,
            COUNT(DISTINCT so.id)::int                  AS os_count
          FROM equipments e
          JOIN service_orders so
            ON  so.equipment_id = e.id
            AND so.deleted_at   IS NULL
            AND so.created_at  >= ${start}
            AND so.created_at  <= ${end}
          LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
          WHERE e.company_id = ${companyId}
            AND e.deleted_at IS NULL
            ${typeF}
            ${locF}
            ${ccF}
          GROUP BY e.id, e.name
          ORDER BY total_cost DESC
          LIMIT ${limit}
        `
        breakdown = rows.map(r => ({ id: r.id, name: r.name, totalCost: r.total_cost, osCount: r.os_count }))

      } else if (groupBy === 'type') {
        const rows = await this.prisma.$queryRaw<Array<{ id: string | null; name: string; total_cost: number; os_count: number }>>`
          SELECT
            et.id,
            COALESCE(et.name, 'Sem tipo')           AS name,
            COALESCE(SUM(soci.total_price), 0)::float8 AS total_cost,
            COUNT(DISTINCT so.id)::int                  AS os_count
          FROM service_orders so
          JOIN equipments               e    ON e.id   = so.equipment_id
          LEFT JOIN equipment_types     et   ON et.id  = e.type_id
          LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
          WHERE so.company_id    = ${companyId}
            AND so.deleted_at   IS NULL
            AND so.created_at   >= ${start}
            AND so.created_at   <= ${end}
            AND so.equipment_id IS NOT NULL
            ${typeF}
            ${locF}
            ${ccF}
          GROUP BY et.id, et.name
          ORDER BY total_cost DESC
          LIMIT ${limit}
        `
        breakdown = rows.map(r => ({ id: r.id, name: r.name, totalCost: r.total_cost, osCount: r.os_count }))

      } else if (groupBy === 'location') {
        const rows = await this.prisma.$queryRaw<Array<{ id: string | null; name: string; total_cost: number; os_count: number }>>`
          SELECT
            l.id,
            COALESCE(l.name, 'Sem localização')     AS name,
            COALESCE(SUM(soci.total_price), 0)::float8 AS total_cost,
            COUNT(DISTINCT so.id)::int                  AS os_count
          FROM service_orders so
          JOIN equipments               e    ON e.id  = so.equipment_id
          LEFT JOIN locations           l    ON l.id  = e.current_location_id
          LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
          WHERE so.company_id    = ${companyId}
            AND so.deleted_at   IS NULL
            AND so.created_at   >= ${start}
            AND so.created_at   <= ${end}
            AND so.equipment_id IS NOT NULL
            ${typeF}
            ${locF}
            ${ccF}
          GROUP BY l.id, l.name
          ORDER BY total_cost DESC
          LIMIT ${limit}
        `
        breakdown = rows.map(r => ({ id: r.id, name: r.name, totalCost: r.total_cost, osCount: r.os_count }))

      } else {
        // costCenter
        const rows = await this.prisma.$queryRaw<Array<{ id: string | null; name: string; total_cost: number; os_count: number }>>`
          SELECT
            cc.id,
            COALESCE(cc.name, 'Sem centro de custo') AS name,
            COALESCE(SUM(soci.total_price), 0)::float8  AS total_cost,
            COUNT(DISTINCT so.id)::int                   AS os_count
          FROM service_orders so
          JOIN equipments               e    ON e.id   = so.equipment_id
          LEFT JOIN cost_centers        cc   ON cc.id  = e.cost_center_id
          LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
          WHERE so.company_id    = ${companyId}
            AND so.deleted_at   IS NULL
            AND so.created_at   >= ${start}
            AND so.created_at   <= ${end}
            AND so.equipment_id IS NOT NULL
            ${typeF}
            ${locF}
            ${ccF}
          GROUP BY cc.id, cc.name
          ORDER BY total_cost DESC
          LIMIT ${limit}
        `
        breakdown = rows.map(r => ({ id: r.id, name: r.name, totalCost: r.total_cost, osCount: r.os_count }))
      }

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        totalCost,
        byItemType: Object.fromEntries(
          byItemType.map(r => [r.type, { total: r.total, itemCount: r.item_count }]),
        ),
        groupBy,
        breakdown,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Equipamentos sem agenda preventiva ativa
  // Ordenados por criticidade e qtd de OS (risco)
  // ─────────────────────────────────────────
  async getWithoutPreventive(companyId: string, filters: EquipmentOverviewQueryDto) {
    const cacheKey = `analytics:equip:nopreventive:${companyId}:${filters.typeId ?? ''}:${filters.locationId ?? ''}:${filters.costCenterId ?? ''}`

    return this.cached(cacheKey, async () => {
      const baseWhere = {
        companyId,
        deletedAt: null,
        status: { notIn: [EquipmentStatus.SCRAPPED, EquipmentStatus.INACTIVE] },
        ...(filters.typeId       && { typeId:            filters.typeId }),
        ...(filters.locationId   && { currentLocationId: filters.locationId }),
        ...(filters.costCenterId && { costCenterId:      filters.costCenterId }),
        schedules: { none: { isActive: true } },
      }

      const [count, items] = await Promise.all([
        this.prisma.equipment.count({ where: baseWhere }),
        this.prisma.equipment.findMany({
          where: baseWhere,
          select: {
            id:               true,
            name:             true,
            brand:            true,
            model:            true,
            serialNumber:     true,
            patrimonyNumber:  true,
            status:           true,
            criticality:      true,
            lastMaintenanceAt: true,
            totalServiceOrders: true,
            type:            { select: { id: true, name: true } },
            currentLocation: { select: { id: true, name: true } },
            costCenter:      { select: { id: true, name: true } },
          },
          orderBy: [
            { criticality: 'desc' },
            { totalServiceOrders: 'desc' },
          ],
          take: 100,
        }),
      ])

      return {
        count,
        items,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Garantias — vencidas e a vencer
  // Equipamento sob garantia não deve gerar custo de manutenção paga; saber o
  // que está prestes a sair da cobertura é o gancho para acionar o fornecedor
  // antes do prazo.
  // ─────────────────────────────────────────
  async getWarranty(companyId: string, filters: EquipmentWarrantyQueryDto) {
    const daysAhead = filters.daysAhead ?? 90
    const scope     = filters.scope ?? 'expiring'
    const limit     = filters.limit ?? 200

    const cacheKey = `analytics:equip:warranty:${companyId}:${daysAhead}:${scope}:${limit}:${filters.typeId ?? ''}:${filters.locationId ?? ''}:${filters.costCenterId ?? ''}`

    return this.cached(cacheKey, async () => {
      const typeF = filters.typeId       ? Prisma.sql`AND e.type_id             = ${filters.typeId}::uuid`       : Prisma.empty
      const locF  = filters.locationId   ? Prisma.sql`AND e.current_location_id = ${filters.locationId}::uuid`   : Prisma.empty
      const ccF   = filters.costCenterId ? Prisma.sql`AND e.cost_center_id      = ${filters.costCenterId}::uuid` : Prisma.empty

      // Sucateados/inativos ficam de fora: a garantia deles é irrelevante
      // operacionalmente e só inflaria as contagens.
      const activeF = Prisma.sql`AND e.status NOT IN ('SCRAPPED', 'INACTIVE')`

      const scopeF =
        scope === 'expired'
          ? Prisma.sql`AND e.warranty_end <  CURRENT_DATE`
          : scope === 'all'
            ? Prisma.sql`AND e.warranty_end <= CURRENT_DATE + ${daysAhead} * INTERVAL '1 day'`
            : Prisma.sql`AND e.warranty_end >= CURRENT_DATE
                         AND e.warranty_end <= CURRENT_DATE + ${daysAhead} * INTERVAL '1 day'`

      const [[summary], items] = await Promise.all([
        this.prisma.$queryRaw<Array<{
          total_tracked:   number
          without_warranty: number
          expired:         number
          due_30:          number
          due_60:          number
          due_90:          number
          due_180:         number
          due_365:         number
          covered:         number
          due_window:      number
          suspect:         number
          value_expiring:  number
        }>>`
          SELECT
            COUNT(*) FILTER (WHERE e.warranty_end IS NOT NULL)::int                             AS total_tracked,
            COUNT(*) FILTER (WHERE e.warranty_end IS NULL)::int                                 AS without_warranty,
            COUNT(*) FILTER (WHERE e.warranty_end <  CURRENT_DATE)::int                         AS expired,
            COUNT(*) FILTER (
              WHERE e.warranty_end >= CURRENT_DATE
                AND e.warranty_end <= CURRENT_DATE + ${daysAhead} * INTERVAL '1 day'
            )::int                                                                              AS due_window,
            -- Fim de garantia anterior ao início denuncia erro de digitação no
            -- ano (o parque tem casos tipo 0025-12-19). Continuam contados como
            -- vencidos, mas sinalizados para correção do cadastro.
            COUNT(*) FILTER (
              WHERE e.warranty_start IS NOT NULL
                AND e.warranty_end   <  e.warranty_start
            )::int                                                                              AS suspect,
            COUNT(*) FILTER (
              WHERE e.warranty_end >= CURRENT_DATE
                AND e.warranty_end <= CURRENT_DATE + INTERVAL '30 days'
            )::int                                                                              AS due_30,
            COUNT(*) FILTER (
              WHERE e.warranty_end >  CURRENT_DATE + INTERVAL '30 days'
                AND e.warranty_end <= CURRENT_DATE + INTERVAL '60 days'
            )::int                                                                              AS due_60,
            COUNT(*) FILTER (
              WHERE e.warranty_end >  CURRENT_DATE + INTERVAL '60 days'
                AND e.warranty_end <= CURRENT_DATE + INTERVAL '90 days'
            )::int                                                                              AS due_90,
            COUNT(*) FILTER (
              WHERE e.warranty_end >  CURRENT_DATE + INTERVAL '90 days'
                AND e.warranty_end <= CURRENT_DATE + INTERVAL '180 days'
            )::int                                                                              AS due_180,
            COUNT(*) FILTER (
              WHERE e.warranty_end >  CURRENT_DATE + INTERVAL '180 days'
                AND e.warranty_end <= CURRENT_DATE + INTERVAL '365 days'
            )::int                                                                              AS due_365,
            COUNT(*) FILTER (WHERE e.warranty_end > CURRENT_DATE + INTERVAL '365 days')::int     AS covered,
            COALESCE(SUM(e.purchase_value) FILTER (
              WHERE e.warranty_end >= CURRENT_DATE
                AND e.warranty_end <= CURRENT_DATE + ${daysAhead} * INTERVAL '1 day'
            ), 0)::float8                                                                       AS value_expiring
          FROM equipments e
          WHERE e.company_id = ${companyId}
            AND e.deleted_at IS NULL
            ${activeF}
            ${typeF}
            ${locF}
            ${ccF}
        `,

        this.prisma.$queryRaw<Array<{
          id:               string
          name:             string
          brand:            string | null
          model:            string | null
          serial_number:    string | null
          patrimony_number: string | null
          status:           string
          criticality:      string
          warranty_start:   Date | null
          warranty_end:     Date
          days_remaining:   number
          purchase_value:   number | null
          type_name:        string | null
          location_name:    string | null
          cost_center_name: string | null
          suspect_date:     boolean
          open_os:          number
        }>>`
          SELECT
            e.id,
            e.name,
            e.brand,
            e.model,
            e.serial_number,
            e.patrimony_number,
            e.status,
            e.criticality,
            e.warranty_start,
            e.warranty_end,
            (e.warranty_end - CURRENT_DATE)::int      AS days_remaining,
            e.purchase_value::float8                  AS purchase_value,
            et.name                                   AS type_name,
            l.name                                    AS location_name,
            cc.name                                   AS cost_center_name,
            (e.warranty_start IS NOT NULL
              AND e.warranty_end < e.warranty_start)  AS suspect_date,
            (
              SELECT COUNT(*)::int
              FROM service_orders so
              WHERE so.equipment_id = e.id
                AND so.deleted_at  IS NULL
                AND so.status NOT IN ('COMPLETED_APPROVED', 'CANCELLED')
            )                                         AS open_os
          FROM equipments e
          LEFT JOIN equipment_types et ON et.id = e.type_id
          LEFT JOIN locations       l  ON l.id  = e.current_location_id
          LEFT JOIN cost_centers    cc ON cc.id = e.cost_center_id
          WHERE e.company_id      = ${companyId}
            AND e.deleted_at     IS NULL
            AND e.warranty_end IS NOT NULL
            ${activeF}
            ${scopeF}
            ${typeF}
            ${locF}
            ${ccF}
          ORDER BY e.warranty_end ASC, e.criticality DESC
          LIMIT ${limit}
        `,
      ])

      return {
        daysAhead,
        scope,
        summary: {
          totalTracked:     summary.total_tracked,
          withoutWarranty:  summary.without_warranty,
          expired:          summary.expired,
          expiringInWindow: summary.due_window,
          suspectDates:     summary.suspect,
          valueExpiring:    summary.value_expiring,
        },
        buckets: [
          { bucket: 'Vencida',      count: summary.expired, severity: 'expired'  as const },
          { bucket: 'Até 30 dias',  count: summary.due_30,  severity: 'critical' as const },
          { bucket: '31–60 dias',   count: summary.due_60,  severity: 'high'     as const },
          { bucket: '61–90 dias',   count: summary.due_90,  severity: 'medium'   as const },
          { bucket: '91–180 dias',  count: summary.due_180, severity: 'low'      as const },
          { bucket: '181–365 dias', count: summary.due_365, severity: 'low'      as const },
          { bucket: '> 1 ano',      count: summary.covered, severity: 'ok'       as const },
        ],
        count: items.length,
        items,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Série temporal de OS por equipamento
  // Útil para ver tendência de falhas ao longo do tempo
  // ─────────────────────────────────────────
  async getOsTimeline(companyId: string, filters: EquipmentRangeQueryDto) {
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)

    const cacheKey = `analytics:equip:timeline:${companyId}:${start.toISOString()}:${end.toISOString()}:${filters.typeId ?? ''}:${filters.locationId ?? ''}`

    return this.cached(cacheKey, async () => {
      const typeF = filters.typeId       ? Prisma.sql`AND e.type_id             = ${filters.typeId}::uuid`       : Prisma.empty
      const locF  = filters.locationId   ? Prisma.sql`AND e.current_location_id = ${filters.locationId}::uuid`   : Prisma.empty
      const ccF   = filters.costCenterId ? Prisma.sql`AND e.cost_center_id      = ${filters.costCenterId}::uuid` : Prisma.empty

      const rows = await this.prisma.$queryRaw<Array<{
        month:        string
        total_os:     number
        corrective:   number
        preventive:   number
        completed_os: number
      }>>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', so.created_at), 'YYYY-MM') AS month,
          COUNT(*)::int                                            AS total_os,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'CORRECTIVE')::int  AS corrective,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'PREVENTIVE')::int  AS preventive,
          COUNT(*) FILTER (WHERE so.status IN ('COMPLETED', 'COMPLETED_APPROVED'))::int AS completed_os
        FROM service_orders so
        JOIN equipments e ON e.id = so.equipment_id
        WHERE so.company_id    = ${companyId}
          AND so.deleted_at   IS NULL
          AND so.equipment_id IS NOT NULL
          AND so.created_at   >= ${start}
          AND so.created_at   <= ${end}
          ${typeF}
          ${locF}
          ${ccF}
        GROUP BY DATE_TRUNC('month', so.created_at)
        ORDER BY month ASC
      `

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        series: rows,
        generatedAt: new Date().toISOString(),
      }
    })
  }

}
