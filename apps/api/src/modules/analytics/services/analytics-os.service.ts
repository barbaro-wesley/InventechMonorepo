import { Injectable, Inject } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../../common/providers/redis.provider'
import type {
  OsBaseQueryDto,
  OsBacklogQueryDto,
  OsComparisonQueryDto,
  OsTimelineQueryDto,
  TechnicianRankingQueryDto,
  OsCostsQueryDto,
} from '../dto/analytics-os-query.dto'

const TTL = 300

@Injectable()
export class AnalyticsOsService {
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

  private buildFilters(f: OsBaseQueryDto) {
    const start = f.startDate ? new Date(f.startDate) : this.startOfYear()
    const end   = f.endDate   ? new Date(f.endDate)   : new Date()
    return {
      start,
      end,
      clientF:  f.clientId       ? Prisma.sql`AND so.client_id        = ${f.clientId}::uuid`          : Prisma.empty,
      groupF:   f.groupId        ? Prisma.sql`AND so.group_id         = ${f.groupId}::uuid`           : Prisma.empty,
      typeF:    f.maintenanceType ? Prisma.sql`AND so.maintenance_type = ${f.maintenanceType}::text`   : Prisma.empty,
      priorityF: f.priority      ? Prisma.sql`AND so.priority         = ${f.priority}::text`          : Prisma.empty,
    }
  }

  // ─────────────────────────────────────────
  // KPIs consolidados de OS no período
  // ─────────────────────────────────────────
  async getOverview(companyId: string, filters: OsBaseQueryDto) {
    const { start, end, clientF, groupF, typeF, priorityF } = this.buildFilters(filters)
    const cacheKey = `analytics:os:overview:${companyId}:${start.toISOString()}:${end.toISOString()}:${filters.clientId ?? ''}:${filters.groupId ?? ''}:${filters.maintenanceType ?? ''}:${filters.priority ?? ''}`

    return this.cached(cacheKey, async () => {
      type OsOverviewRow = {
        total:                number
        open_os:              number
        awaiting_pickup:      number
        in_progress:          number
        completed:            number
        approved:             number
        rejected:             number
        cancelled:            number
        urgent_active:        number
        priority_low:         number
        priority_medium:      number
        priority_high:        number
        priority_urgent:      number
        type_corrective:      number
        type_preventive:      number
        type_initial_accept:  number
        type_external:        number
        type_technovigilance: number
        type_training:        number
        type_improper_use:    number
        type_deactivation:    number
        child_os:             number
        avg_response_hours:   number | null
        avg_resolution_hours: number | null
        avg_total_hours:      number | null
        total_cost:           number
      }
      const [main] = await this.prisma.$queryRaw<OsOverviewRow[]>`
        SELECT
          COUNT(*)::int                                                                           AS total,
          COUNT(*) FILTER (WHERE so.status = 'OPEN')::int                                        AS open_os,
          COUNT(*) FILTER (WHERE so.status = 'AWAITING_PICKUP')::int                             AS awaiting_pickup,
          COUNT(*) FILTER (WHERE so.status = 'IN_PROGRESS')::int                                 AS in_progress,
          COUNT(*) FILTER (WHERE so.status = 'COMPLETED')::int                                   AS completed,
          COUNT(*) FILTER (WHERE so.status = 'COMPLETED_APPROVED')::int                          AS approved,
          COUNT(*) FILTER (WHERE so.status = 'COMPLETED_REJECTED')::int                          AS rejected,
          COUNT(*) FILTER (WHERE so.status = 'CANCELLED')::int                                   AS cancelled,
          COUNT(*) FILTER (
            WHERE so.priority = 'URGENT'
              AND so.status NOT IN ('COMPLETED_APPROVED', 'CANCELLED')
          )::int                                                                                  AS urgent_active,
          COUNT(*) FILTER (WHERE so.priority = 'LOW')::int                                       AS priority_low,
          COUNT(*) FILTER (WHERE so.priority = 'MEDIUM')::int                                    AS priority_medium,
          COUNT(*) FILTER (WHERE so.priority = 'HIGH')::int                                      AS priority_high,
          COUNT(*) FILTER (WHERE so.priority = 'URGENT')::int                                    AS priority_urgent,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'CORRECTIVE')::int                        AS type_corrective,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'PREVENTIVE')::int                        AS type_preventive,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'INITIAL_ACCEPTANCE')::int                AS type_initial_accept,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'EXTERNAL_SERVICE')::int                  AS type_external,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'TECHNOVIGILANCE')::int                   AS type_technovigilance,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'TRAINING')::int                          AS type_training,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'IMPROPER_USE')::int                      AS type_improper_use,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'DEACTIVATION')::int                      AS type_deactivation,
          COUNT(*) FILTER (WHERE so.parent_service_order_id IS NOT NULL)::int                    AS child_os,
          ROUND(AVG(
            CASE WHEN so.started_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (so.started_at - so.created_at)) / 3600.0
            END
          )::numeric, 1)::float8                                                                  AS avg_response_hours,
          ROUND(AVG(
            CASE WHEN so.completed_at IS NOT NULL AND so.started_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (so.completed_at - so.started_at)) / 3600.0
            END
          )::numeric, 1)::float8                                                                  AS avg_resolution_hours,
          ROUND(AVG(
            CASE WHEN so.completed_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (so.completed_at - so.created_at)) / 3600.0
            END
          )::numeric, 1)::float8                                                                  AS avg_total_hours,
          COALESCE(SUM(so.total_cost), 0)::float8                                                 AS total_cost
        FROM service_orders so
        WHERE so.company_id  = ${companyId}
          AND so.deleted_at IS NULL
          AND so.created_at >= ${start}
          AND so.created_at <= ${end}
          ${clientF}
          ${groupF}
          ${typeF}
          ${priorityF}
      `

      const totalClosed = main.approved + main.rejected + main.cancelled
      const approvalRate = totalClosed > 0
        ? Math.round((main.approved / (main.approved + main.rejected)) * 100)
        : null

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        total: main.total,
        byStatus: {
          open:           main.open_os,
          awaitingPickup: main.awaiting_pickup,
          inProgress:     main.in_progress,
          completed:      main.completed,
          approved:       main.approved,
          rejected:       main.rejected,
          cancelled:      main.cancelled,
        },
        byPriority: {
          low:    main.priority_low,
          medium: main.priority_medium,
          high:   main.priority_high,
          urgent: main.priority_urgent,
        },
        byMaintenanceType: {
          corrective:        main.type_corrective,
          preventive:        main.type_preventive,
          initialAcceptance: main.type_initial_accept,
          externalService:   main.type_external,
          technovigilance:   main.type_technovigilance,
          training:          main.type_training,
          improperUse:       main.type_improper_use,
          deactivation:      main.type_deactivation,
        },
        sla: {
          avgResponseHours:   main.avg_response_hours,
          avgResolutionHours: main.avg_resolution_hours,
          avgTotalHours:      main.avg_total_hours,
        },
        rates: {
          approvalRate,
          urgentActive:   main.urgent_active,
          childOsCount:   main.child_os,
          childOsRate:    main.total > 0
            ? Math.round((main.child_os / main.total) * 100)
            : 0,
        },
        totalCost: main.total_cost,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Série temporal de OS criadas no período
  // ─────────────────────────────────────────
  async getTimeline(companyId: string, filters: OsTimelineQueryDto) {
    const { start, end, clientF, groupF, typeF, priorityF } = this.buildFilters(filters)
    const granularity = filters.groupBy ?? 'month'
    const cacheKey = `analytics:os:timeline:${companyId}:${start.toISOString()}:${end.toISOString()}:${granularity}:${filters.clientId ?? ''}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      const trunc  = this.truncSql(granularity)
      const format = this.truncFormat(granularity)

      const rows = await this.prisma.$queryRaw<Array<{
        period:       string
        total:        number
        completed:    number
        cancelled:    number
        corrective:   number
        preventive:   number
        total_cost:   number
      }>>`
        SELECT
          TO_CHAR(${trunc}, ${format})                                                            AS period,
          COUNT(*)::int                                                                           AS total,
          COUNT(*) FILTER (WHERE so.status IN ('COMPLETED', 'COMPLETED_APPROVED'))::int           AS completed,
          COUNT(*) FILTER (WHERE so.status = 'CANCELLED')::int                                   AS cancelled,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'CORRECTIVE')::int                        AS corrective,
          COUNT(*) FILTER (WHERE so.maintenance_type = 'PREVENTIVE')::int                        AS preventive,
          COALESCE(SUM(so.total_cost), 0)::float8                                                AS total_cost
        FROM service_orders so
        WHERE so.company_id  = ${companyId}
          AND so.deleted_at IS NULL
          AND so.created_at >= ${start}
          AND so.created_at <= ${end}
          ${clientF}
          ${groupF}
          ${typeF}
          ${priorityF}
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
  // Ranking de técnicos com métricas detalhadas
  // ─────────────────────────────────────────
  async getTechnicianRanking(companyId: string, filters: TechnicianRankingQueryDto) {
    const { start, end, clientF, groupF, typeF, priorityF } = this.buildFilters(filters)
    const limit = filters.limit ?? 20
    const techF = filters.technicianId
      ? Prisma.sql`AND sot.technician_id = ${filters.technicianId}::uuid`
      : Prisma.empty
    const cacheKey = `analytics:os:technicians:${companyId}:${start.toISOString()}:${end.toISOString()}:${filters.groupId ?? ''}:${filters.technicianId ?? ''}:${limit}`

    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.$queryRaw<Array<{
        technician_id:       string
        name:                string
        avatar_url:          string | null
        total_os:            number
        completed_os:        number
        rejected_os:         number
        avg_response_hours:  number | null
        avg_resolution_hours: number | null
        labor_cost:          number
      }>>`
        SELECT
          u.id                                                                                     AS technician_id,
          u.name,
          u.avatar_url,
          COUNT(DISTINCT sot.service_order_id)::int                                               AS total_os,
          COUNT(DISTINCT so.id) FILTER (
            WHERE so.status IN ('COMPLETED', 'COMPLETED_APPROVED')
          )::int                                                                                  AS completed_os,
          COUNT(DISTINCT so.id) FILTER (
            WHERE so.status = 'COMPLETED_REJECTED'
          )::int                                                                                  AS rejected_os,
          ROUND(AVG(
            CASE WHEN so.started_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (so.started_at - so.created_at)) / 3600.0
            END
          )::numeric, 1)::float8                                                                  AS avg_response_hours,
          ROUND(AVG(
            CASE WHEN so.completed_at IS NOT NULL AND so.started_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (so.completed_at - so.started_at)) / 3600.0
            END
          )::numeric, 1)::float8                                                                  AS avg_resolution_hours,
          COALESCE(SUM(soci.total_price) FILTER (WHERE soci.type = 'LABOR'), 0)::float8          AS labor_cost
        FROM service_order_technicians sot
        JOIN users                     u    ON u.id   = sot.technician_id
        JOIN service_orders            so   ON so.id  = sot.service_order_id
        LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
        WHERE so.company_id  = ${companyId}
          AND so.deleted_at IS NULL
          AND so.created_at >= ${start}
          AND so.created_at <= ${end}
          ${clientF}
          ${groupF}
          ${typeF}
          ${priorityF}
          ${techF}
        GROUP BY u.id, u.name, u.avatar_url
        ORDER BY completed_os DESC, total_os DESC
        LIMIT ${limit}
      `

      const enriched = rows.map(r => ({
        ...r,
        completionRate: r.total_os > 0
          ? Math.round((r.completed_os / r.total_os) * 100)
          : 0,
      }))

      return {
        period:      { start: start.toISOString(), end: end.toISOString() },
        technicians: enriched,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Custo de OS por tipo de item e dimensão
  // ─────────────────────────────────────────
  async getCosts(companyId: string, filters: OsCostsQueryDto) {
    const { start, end, clientF, groupF, typeF, priorityF } = this.buildFilters(filters)
    const groupBy = filters.groupBy ?? 'maintenanceType'
    const limit   = filters.limit ?? 20
    const cacheKey = `analytics:os:costs:${companyId}:${start.toISOString()}:${end.toISOString()}:${groupBy}:${filters.clientId ?? ''}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      const byItemType = await this.prisma.$queryRaw<Array<{
        type:       string
        total:      number
        item_count: number
        os_count:   number
      }>>`
        SELECT
          soci.type,
          SUM(soci.total_price)::float8      AS total,
          COUNT(soci.id)::int                AS item_count,
          COUNT(DISTINCT so.id)::int         AS os_count
        FROM service_order_cost_items soci
        JOIN service_orders so ON so.id = soci.service_order_id
        WHERE so.company_id  = ${companyId}
          AND so.deleted_at IS NULL
          AND so.created_at >= ${start}
          AND so.created_at <= ${end}
          ${clientF}
          ${groupF}
          ${typeF}
          ${priorityF}
        GROUP BY soci.type
        ORDER BY total DESC
      `

      const totalCost = byItemType.reduce((s, r) => s + r.total, 0)

      type Row = { id: string | null; name: string; totalCost: number; osCount: number; avgCost: number }
      let breakdown: Row[] = []

      if (groupBy === 'maintenanceType') {
        const rows = await this.prisma.$queryRaw<Array<{ name: string; total_cost: number; os_count: number }>>`
          SELECT
            so.maintenance_type                                AS name,
            COALESCE(SUM(soci.total_price), 0)::float8        AS total_cost,
            COUNT(DISTINCT so.id)::int                         AS os_count
          FROM service_orders so
          LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
          WHERE so.company_id  = ${companyId}
            AND so.deleted_at IS NULL
            AND so.created_at >= ${start}
            AND so.created_at <= ${end}
            ${clientF}
            ${groupF}
            ${priorityF}
          GROUP BY so.maintenance_type
          ORDER BY total_cost DESC
        `
        breakdown = rows.map(r => ({
          id: null, name: r.name, totalCost: r.total_cost, osCount: r.os_count,
          avgCost: r.os_count > 0 ? Math.round(r.total_cost / r.os_count) : 0,
        }))

      } else if (groupBy === 'client') {
        const rows = await this.prisma.$queryRaw<Array<{ id: string | null; name: string; total_cost: number; os_count: number }>>`
          SELECT
            c.id,
            COALESCE(c.name, 'Sem cliente')                   AS name,
            COALESCE(SUM(soci.total_price), 0)::float8        AS total_cost,
            COUNT(DISTINCT so.id)::int                         AS os_count
          FROM service_orders so
          LEFT JOIN clients    c    ON c.id = so.client_id
          LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
          WHERE so.company_id  = ${companyId}
            AND so.deleted_at IS NULL
            AND so.created_at >= ${start}
            AND so.created_at <= ${end}
            ${groupF}
            ${typeF}
            ${priorityF}
          GROUP BY c.id, c.name
          ORDER BY total_cost DESC
          LIMIT ${limit}
        `
        breakdown = rows.map(r => ({
          id: r.id, name: r.name, totalCost: r.total_cost, osCount: r.os_count,
          avgCost: r.os_count > 0 ? Math.round(r.total_cost / r.os_count) : 0,
        }))

      } else if (groupBy === 'group') {
        const rows = await this.prisma.$queryRaw<Array<{ id: string | null; name: string; total_cost: number; os_count: number }>>`
          SELECT
            mg.id,
            COALESCE(mg.name, 'Sem grupo')                    AS name,
            COALESCE(SUM(soci.total_price), 0)::float8        AS total_cost,
            COUNT(DISTINCT so.id)::int                         AS os_count
          FROM service_orders so
          LEFT JOIN maintenance_groups mg   ON mg.id = so.group_id
          LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
          WHERE so.company_id  = ${companyId}
            AND so.deleted_at IS NULL
            AND so.created_at >= ${start}
            AND so.created_at <= ${end}
            ${clientF}
            ${typeF}
            ${priorityF}
          GROUP BY mg.id, mg.name
          ORDER BY total_cost DESC
          LIMIT ${limit}
        `
        breakdown = rows.map(r => ({
          id: r.id, name: r.name, totalCost: r.total_cost, osCount: r.os_count,
          avgCost: r.os_count > 0 ? Math.round(r.total_cost / r.os_count) : 0,
        }))

      } else {
        // technician
        const rows = await this.prisma.$queryRaw<Array<{ id: string; name: string; total_cost: number; os_count: number }>>`
          SELECT
            u.id,
            u.name,
            COALESCE(SUM(soci.total_price), 0)::float8        AS total_cost,
            COUNT(DISTINCT so.id)::int                         AS os_count
          FROM service_order_technicians sot
          JOIN users                     u    ON u.id  = sot.technician_id
          JOIN service_orders            so   ON so.id = sot.service_order_id
          LEFT JOIN service_order_cost_items soci ON soci.service_order_id = so.id
          WHERE so.company_id  = ${companyId}
            AND so.deleted_at IS NULL
            AND so.created_at >= ${start}
            AND so.created_at <= ${end}
            ${clientF}
            ${groupF}
            ${typeF}
            ${priorityF}
          GROUP BY u.id, u.name
          ORDER BY total_cost DESC
          LIMIT ${limit}
        `
        breakdown = rows.map(r => ({
          id: r.id, name: r.name, totalCost: r.total_cost, osCount: r.os_count,
          avgCost: r.os_count > 0 ? Math.round(r.total_cost / r.os_count) : 0,
        }))
      }

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        totalCost,
        byItemType: Object.fromEntries(
          byItemType.map(r => [r.type, { total: r.total, itemCount: r.item_count, osCount: r.os_count }]),
        ),
        groupBy,
        breakdown,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Aging do backlog — OS abertas por faixa de idade
  // Mostra represamento operacional
  // ─────────────────────────────────────────
  async getBacklogAging(companyId: string, filters: OsBacklogQueryDto) {
    const clientF = filters.clientId ? Prisma.sql`AND so.client_id = ${filters.clientId}::uuid` : Prisma.empty
    const groupF  = filters.groupId  ? Prisma.sql`AND so.group_id  = ${filters.groupId}::uuid`  : Prisma.empty

    const cacheKey = `analytics:os:backlog:${companyId}:${filters.clientId ?? ''}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      // Contagens por faixa de idade
      const [buckets] = await Promise.all([
        this.prisma.$queryRaw<Array<{
          bucket:        string
          count:         number
          avg_days_open: number
          urgent_count:  number
        }>>`
          SELECT
            CASE
              WHEN days_open <  7  THEN '0-7d'
              WHEN days_open <  30 THEN '7-30d'
              WHEN days_open <  90 THEN '30-90d'
              ELSE                      '>90d'
            END                                             AS bucket,
            COUNT(*)::int                                   AS count,
            ROUND(AVG(days_open)::numeric, 1)::float8       AS avg_days_open,
            COUNT(*) FILTER (WHERE priority = 'URGENT')::int AS urgent_count
          FROM (
            SELECT
              so.id,
              so.priority,
              EXTRACT(DAY FROM (NOW() - so.created_at))::int AS days_open
            FROM service_orders so
            WHERE so.company_id = ${companyId}
              AND so.deleted_at IS NULL
              AND so.status NOT IN ('COMPLETED_APPROVED', 'CANCELLED', 'COMPLETED_REJECTED')
              ${clientF}
              ${groupF}
          ) sub
          GROUP BY bucket
          ORDER BY
            CASE bucket
              WHEN '0-7d'   THEN 1
              WHEN '7-30d'  THEN 2
              WHEN '30-90d' THEN 3
              ELSE               4
            END
        `,
      ])

      // OS mais antigas em aberto (top 15) para detalhe no painel
      const oldest = await this.prisma.$queryRaw<Array<{
        id:           string
        number:       number
        title:        string
        status:       string
        priority:     string
        days_open:    number
        equipment:    string | null
        group_name:   string | null
        client_name:  string | null
      }>>`
        SELECT
          so.id,
          so.number,
          so.title,
          so.status,
          so.priority,
          EXTRACT(DAY FROM (NOW() - so.created_at))::int AS days_open,
          e.name   AS equipment,
          mg.name  AS group_name,
          c.name   AS client_name
        FROM service_orders so
        LEFT JOIN equipments        e   ON e.id  = so.equipment_id
        LEFT JOIN maintenance_groups mg ON mg.id = so.group_id
        LEFT JOIN clients            c  ON c.id  = so.client_id
        WHERE so.company_id = ${companyId}
          AND so.deleted_at IS NULL
          AND so.status NOT IN ('COMPLETED_APPROVED', 'CANCELLED', 'COMPLETED_REJECTED')
          ${clientF}
          ${groupF}
        ORDER BY so.created_at ASC
        LIMIT 15
      `

      const totalOpen = buckets.reduce((s, b) => s + b.count, 0)
      const criticalCount = (buckets.find(b => b.bucket === '>90d')?.count ?? 0)
        + (buckets.find(b => b.bucket === '30-90d')?.count ?? 0)

      return {
        totalOpen,
        criticalCount,
        buckets,
        oldest,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Comparativo de período + First-Time Fix Rate
  // Compara período atual vs período anterior equivalente
  // ─────────────────────────────────────────
  async getComparison(companyId: string, filters: OsComparisonQueryDto) {
    const { start, end, clientF, groupF, typeF, priorityF } = this.buildFilters(filters)

    const durationMs = end.getTime() - start.getTime()
    const prevEnd    = new Date(start.getTime() - 1)
    const prevStart  = new Date(prevEnd.getTime() - durationMs)

    const cacheKey = `analytics:os:comparison:${companyId}:${start.toISOString()}:${end.toISOString()}:${filters.clientId ?? ''}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      type PeriodMetrics = {
        total:                number
        completed:            number
        cancelled:            number
        rejected:             number
        avg_resolution_hours: number | null
        avg_response_hours:   number | null
        total_cost:           number
        first_time_completed: number
      }

      const periodQuery = (s: Date, e: Date) => this.prisma.$queryRaw<PeriodMetrics[]>`
        SELECT
          COUNT(*)::int                                                                     AS total,
          COUNT(*) FILTER (WHERE so.status IN ('COMPLETED', 'COMPLETED_APPROVED'))::int    AS completed,
          COUNT(*) FILTER (WHERE so.status = 'CANCELLED')::int                             AS cancelled,
          COUNT(*) FILTER (WHERE so.status = 'COMPLETED_REJECTED')::int                   AS rejected,
          ROUND(AVG(
            CASE WHEN so.completed_at IS NOT NULL AND so.started_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (so.completed_at - so.started_at)) / 3600.0
            END
          )::numeric, 1)::float8                                                            AS avg_resolution_hours,
          ROUND(AVG(
            CASE WHEN so.started_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (so.started_at - so.created_at)) / 3600.0
            END
          )::numeric, 1)::float8                                                            AS avg_response_hours,
          COALESCE(SUM(so.total_cost), 0)::float8                                           AS total_cost,
          COUNT(*) FILTER (
            WHERE so.status IN ('COMPLETED', 'COMPLETED_APPROVED')
              AND NOT EXISTS (
                SELECT 1 FROM service_orders child
                WHERE child.parent_service_order_id = so.id
                  AND child.deleted_at IS NULL
              )
          )::int                                                                             AS first_time_completed
        FROM service_orders so
        WHERE so.company_id  = ${companyId}
          AND so.deleted_at IS NULL
          AND so.created_at >= ${s}
          AND so.created_at <= ${e}
          ${clientF}
          ${groupF}
          ${typeF}
          ${priorityF}
      `

      const [currentRows, previousRows] = await Promise.all([
        periodQuery(start, end),
        periodQuery(prevStart, prevEnd),
      ])

      const cur  = currentRows[0]
      const prev = previousRows[0]

      const ftfr = (row: PeriodMetrics) =>
        row.completed > 0 ? Math.round((row.first_time_completed / row.completed) * 100) : null

      const delta = (c: number | null, p: number | null) => {
        if (c === null || p === null) return null
        const absolute = Math.round((c - p) * 10) / 10
        const percent  = p > 0 ? Math.round(((c - p) / p) * 1000) / 10 : null
        return { absolute, percent }
      }

      return {
        current: {
          period: { start: start.toISOString(), end: end.toISOString() },
          total:               cur.total,
          completed:           cur.completed,
          cancelled:           cur.cancelled,
          rejected:            cur.rejected,
          avgResolutionHours:  cur.avg_resolution_hours,
          avgResponseHours:    cur.avg_response_hours,
          totalCost:           cur.total_cost,
          firstTimeFixRate:    ftfr(cur),
        },
        previous: {
          period: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
          total:               prev.total,
          completed:           prev.completed,
          cancelled:           prev.cancelled,
          rejected:            prev.rejected,
          avgResolutionHours:  prev.avg_resolution_hours,
          avgResponseHours:    prev.avg_response_hours,
          totalCost:           prev.total_cost,
          firstTimeFixRate:    ftfr(prev),
        },
        delta: {
          total:              delta(cur.total,              prev.total),
          completed:          delta(cur.completed,          prev.completed),
          avgResolutionHours: delta(cur.avg_resolution_hours, prev.avg_resolution_hours),
          avgResponseHours:   delta(cur.avg_response_hours,   prev.avg_response_hours),
          totalCost:          delta(cur.total_cost,         prev.total_cost),
          firstTimeFixRate:   delta(ftfr(cur),              ftfr(prev)),
        },
        generatedAt: new Date().toISOString(),
      }
    })
  }

  private truncSql(granularity: string): Prisma.Sql {
    if (granularity === 'day')  return Prisma.sql`DATE_TRUNC('day',   so.created_at)`
    if (granularity === 'week') return Prisma.sql`DATE_TRUNC('week',  so.created_at)`
    return                             Prisma.sql`DATE_TRUNC('month', so.created_at)`
  }

  private truncFormat(granularity: string): string {
    if (granularity === 'day')  return 'YYYY-MM-DD'
    if (granularity === 'week') return 'IYYY-"W"IW'
    return                             'YYYY-MM'
  }

  private startOfYear(): Date {
    const d = new Date()
    d.setMonth(0, 1)
    d.setHours(0, 0, 0, 0)
    return d
  }
}
