import { Injectable, Inject } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../../common/providers/redis.provider'
import type {
  FinancialQueryDto,
  FinancialTrendQueryDto,
  FinancialTcoQueryDto,
} from '../dto/analytics-financial-query.dto'

const TTL = 300

@Injectable()
export class AnalyticsFinancialService {
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

  // ────────────────────────���────────────────
  // Resumo financeiro do período
  // Inclui comparação automática com período anterior equivalente
  // ─────────────────────────────────────────
  async getOverview(companyId: string, filters: FinancialQueryDto) {
    const start = filters.startDate ? new Date(filters.startDate) : this.startOfYear()
    const end   = filters.endDate   ? new Date(filters.endDate)   : new Date()

    const durationMs = end.getTime() - start.getTime()
    const prevEnd    = new Date(start.getTime() - 1)
    const prevStart  = new Date(prevEnd.getTime() - durationMs)

    const clientF = filters.clientId ? Prisma.sql`AND so.client_id = ${filters.clientId}::uuid` : Prisma.empty
    const groupF  = filters.groupId  ? Prisma.sql`AND so.group_id  = ${filters.groupId}::uuid`  : Prisma.empty

    const cacheKey = `analytics:fin:overview:${companyId}:${start.toISOString()}:${end.toISOString()}:${filters.clientId ?? ''}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      type PeriodRow = {
        total_cost:    number
        labor:         number
        material:      number
        external:      number
        travel:        number
        other:         number
        os_count:      number
        os_with_cost:  number
      }

      const [current, previous] = await Promise.all([
        this.prisma.$queryRaw<PeriodRow[]>`
          SELECT
            COALESCE(SUM(soci.total_price), 0)::float8                                     AS total_cost,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'LABOR'),    0)::float8 AS labor,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'MATERIAL'), 0)::float8 AS material,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'EXTERNAL'), 0)::float8 AS external,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'TRAVEL'),   0)::float8 AS travel,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'OTHER'),    0)::float8 AS other,
            COUNT(DISTINCT so.id)::int                                                      AS os_count,
            COUNT(DISTINCT so.id) FILTER (WHERE so.total_cost > 0)::int                    AS os_with_cost
          FROM service_order_cost_items soci
          JOIN service_orders so ON so.id = soci.service_order_id
          WHERE so.company_id  = ${companyId}
            AND so.deleted_at IS NULL
            AND so.created_at >= ${start}
            AND so.created_at <= ${end}
            ${clientF}
            ${groupF}
        `,
        this.prisma.$queryRaw<PeriodRow[]>`
          SELECT
            COALESCE(SUM(soci.total_price), 0)::float8                                     AS total_cost,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'LABOR'),    0)::float8 AS labor,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'MATERIAL'), 0)::float8 AS material,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'EXTERNAL'), 0)::float8 AS external,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'TRAVEL'),   0)::float8 AS travel,
            COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'OTHER'),    0)::float8 AS other,
            COUNT(DISTINCT so.id)::int                                                      AS os_count,
            COUNT(DISTINCT so.id) FILTER (WHERE so.total_cost > 0)::int                    AS os_with_cost
          FROM service_order_cost_items soci
          JOIN service_orders so ON so.id = soci.service_order_id
          WHERE so.company_id  = ${companyId}
            AND so.deleted_at IS NULL
            AND so.created_at >= ${prevStart}
            AND so.created_at <= ${prevEnd}
            ${clientF}
            ${groupF}
        `,
      ])

      const cur  = current[0]
      const prev = previous[0]

      const avgCostPerOs = cur.os_with_cost > 0
        ? Math.round(cur.total_cost / cur.os_with_cost)
        : 0

      return {
        period:         { start: start.toISOString(), end: end.toISOString() },
        previousPeriod: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
        current: {
          totalCost:    cur.total_cost,
          byItemType:   { labor: cur.labor, material: cur.material, external: cur.external, travel: cur.travel, other: cur.other },
          osCount:      cur.os_count,
          osWithCost:   cur.os_with_cost,
          avgCostPerOs,
        },
        previous: {
          totalCost:    prev.total_cost,
          byItemType:   { labor: prev.labor, material: prev.material, external: prev.external, travel: prev.travel, other: prev.other },
          osCount:      prev.os_count,
          osWithCost:   prev.os_with_cost,
          avgCostPerOs: prev.os_with_cost > 0 ? Math.round(prev.total_cost / prev.os_with_cost) : 0,
        },
        delta: {
          totalCost:  this.delta(cur.total_cost, prev.total_cost),
          osCount:    this.delta(cur.os_count,   prev.os_count),
          labor:      this.delta(cur.labor,      prev.labor),
          material:   this.delta(cur.material,   prev.material),
          external:   this.delta(cur.external,   prev.external),
        },
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Evolução mensal/trimestral de custo
  // ────────────────────────────���────────────
  async getTrend(companyId: string, filters: FinancialTrendQueryDto) {
    const start     = filters.startDate ? new Date(filters.startDate) : this.startOfYear()
    const end       = filters.endDate   ? new Date(filters.endDate)   : new Date()
    const granularity = filters.groupBy ?? 'month'

    const clientF = filters.clientId ? Prisma.sql`AND so.client_id = ${filters.clientId}::uuid` : Prisma.empty
    const groupF  = filters.groupId  ? Prisma.sql`AND so.group_id  = ${filters.groupId}::uuid`  : Prisma.empty

    const trunc = granularity === 'quarter'
      ? Prisma.sql`DATE_TRUNC('quarter', so.created_at)`
      : Prisma.sql`DATE_TRUNC('month',   so.created_at)`

    const fmt = granularity === 'quarter' ? 'YYYY-"Q"Q' : 'YYYY-MM'

    const cacheKey = `analytics:fin:trend:${companyId}:${start.toISOString()}:${end.toISOString()}:${granularity}:${filters.clientId ?? ''}`

    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.$queryRaw<Array<{
        period:   string
        total:    number
        labor:    number
        material: number
        external: number
        travel:   number
        other:    number
        os_count: number
      }>>`
        SELECT
          TO_CHAR(${trunc}, ${fmt})                                                          AS period,
          COALESCE(SUM(soci.total_price), 0)::float8                                        AS total,
          COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'LABOR'),    0)::float8  AS labor,
          COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'MATERIAL'), 0)::float8  AS material,
          COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'EXTERNAL'), 0)::float8  AS external,
          COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'TRAVEL'),   0)::float8  AS travel,
          COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'OTHER'),    0)::float8  AS other,
          COUNT(DISTINCT so.id)::int                                                        AS os_count
        FROM service_order_cost_items soci
        JOIN service_orders so ON so.id = soci.service_order_id
        WHERE so.company_id  = ${companyId}
          AND so.deleted_at IS NULL
          AND so.created_at >= ${start}
          AND so.created_at <= ${end}
          ${clientF}
          ${groupF}
        GROUP BY ${trunc}
        ORDER BY ${trunc} ASC
      `

      return {
        period:      { start: start.toISOString(), end: end.toISOString() },
        granularity,
        series:      rows,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Custo Total de Propriedade (TCO) por equipamento
  // TCO = valor de compra + custo acumulado de todas as OS
  // ─────────────────────────────────────────
  async getTco(companyId: string, filters: FinancialTcoQueryDto) {
    const limit = filters.limit ?? 20

    const typeF = filters.typeId       ? Prisma.sql`AND e.type_id             = ${filters.typeId}::uuid`       : Prisma.empty
    const locF  = filters.locationId   ? Prisma.sql`AND e.current_location_id = ${filters.locationId}::uuid`   : Prisma.empty
    const ccF   = filters.costCenterId ? Prisma.sql`AND e.cost_center_id      = ${filters.costCenterId}::uuid` : Prisma.empty

    const cacheKey = `analytics:fin:tco:${companyId}:${filters.typeId ?? ''}:${filters.locationId ?? ''}:${limit}`

    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.$queryRaw<Array<{
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
        purchase_value:   number
        current_value:    number
        maintenance_cost: number
        os_count:         number
        tco:              number
        cost_ratio:       number | null
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
          et.name                                                                   AS type_name,
          l.name                                                                    AS location_name,
          COALESCE(e.purchase_value, 0)::float8                                    AS purchase_value,
          COALESCE(e.current_value,  0)::float8                                    AS current_value,
          COALESCE(SUM(soci.total_price), 0)::float8                               AS maintenance_cost,
          COUNT(DISTINCT so.id)::int                                                AS os_count,
          (COALESCE(e.purchase_value, 0) + COALESCE(SUM(soci.total_price), 0))::float8 AS tco,
          CASE
            WHEN e.purchase_value > 0
            THEN ROUND((COALESCE(SUM(soci.total_price), 0) / e.purchase_value * 100)::numeric, 1)::float8
          END                                                                       AS cost_ratio
        FROM equipments e
        LEFT JOIN equipment_types          et   ON et.id  = e.type_id
        LEFT JOIN locations                l    ON l.id   = e.current_location_id
        LEFT JOIN service_orders           so   ON so.equipment_id = e.id AND so.deleted_at IS NULL
        LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
        WHERE e.company_id = ${companyId}
          AND e.deleted_at IS NULL
          ${typeF}
          ${locF}
          ${ccF}
        GROUP BY e.id, e.name, e.brand, e.model, e.serial_number, e.patrimony_number,
                 e.status, e.criticality, e.purchase_value, e.current_value, et.name, l.name
        ORDER BY maintenance_cost DESC
        LIMIT ${limit}
      `

      const totalMaintenanceCost = rows.reduce((s, r) => s + r.maintenance_cost, 0)
      const totalPurchaseValue   = rows.reduce((s, r) => s + r.purchase_value, 0)

      return {
        summary: {
          totalMaintenanceCost,
          totalPurchaseValue,
          totalTco: totalPurchaseValue + totalMaintenanceCost,
        },
        items:       rows,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  private delta(current: number, previous: number): { absolute: number; percent: number | null } {
    const absolute = Math.round((current - previous) * 100) / 100
    const percent  = previous > 0
      ? Math.round(((current - previous) / previous) * 1000) / 10
      : null
    return { absolute, percent }
  }

  private startOfYear(): Date {
    const d = new Date()
    d.setMonth(0, 1)
    d.setHours(0, 0, 0, 0)
    return d
  }
}
