import { Injectable, Inject } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../../common/providers/redis.provider'
import { DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS } from '../../sla/sla.service'
import { resolvePeriod, pickGranularity, granularityParts } from '../analytics-period.util'
import type {
  ProvidersQueryDto,
  ProvidersTimelineQueryDto,
} from '../dto/analytics-providers-query.dto'

const TTL = 300

const DEFAULT_PREVENTIVE_DEADLINE_HOURS = DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS.PREVENTIVE

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null)

@Injectable()
export class AnalyticsProvidersService {
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
  // Base comum: OS com o prestador responsável
  //
  // Prestador = so.client_id. Quando a OS foi aberta para um grupo e assumida
  // do painel, o client_id fica nulo; nesse caso o trabalho é creditado ao
  // prestador do técnico vinculado (o ativo, líder primeiro). Sem nenhum dos
  // dois, a OS é da equipe interna (provider_id nulo).
  //
  // Canceladas ficam de fora: não representam trabalho feito.
  // ─────────────────────────────────────────
  private providerOs(companyId: string, groupId?: string) {
    const groupF = groupId ? Prisma.sql`AND so.group_id = ${groupId}` : Prisma.empty

    return Prisma.sql`
      SELECT
        so.id,
        so.status,
        so.maintenance_type::text                                                AS maintenance_type,
        so.created_at,
        so.started_at,
        so.sla_status,
        so.sla_response_due_date,
        so.sla_response_breached_at,
        so.equipment_id,
        COALESCE(so.client_id, tp.client_id)                                     AS provider_id,
        so.status IN ('COMPLETED', 'COMPLETED_APPROVED')                         AS concluded,
        CASE WHEN so.status IN ('COMPLETED', 'COMPLETED_APPROVED')
             THEN COALESCE(so.completed_at, so.updated_at)
        END                                                                      AS done_at,
        -- Prazo da preventiva: o mesmo critério da aba de preventivas
        -- (parâmetros de SLA por tipo × prioridade, a partir da abertura).
        CASE WHEN so.maintenance_type = 'PREVENTIVE'
             THEN so.created_at
                  + COALESCE(cfg.max_resolution_hours, ${DEFAULT_PREVENTIVE_DEADLINE_HOURS}::numeric)::float8
                  * INTERVAL '1 hour'
        END                                                                      AS prev_due_at,
        CASE WHEN ci.total > 0 THEN ci.total ELSE COALESCE(so.total_cost, 0) END AS cost,
        EXISTS (
          SELECT 1 FROM service_orders child
          WHERE child.parent_service_order_id = so.id
            AND child.deleted_at IS NULL
        )                                                                        AS has_child,
        EXISTS (
          SELECT 1 FROM service_order_status_history h
          WHERE h.service_order_id = so.id
            AND h.to_status = 'COMPLETED_REJECTED'
        )                                                                        AS was_rejected
      FROM service_orders so
      LEFT JOIN LATERAL (
        SELECT u.client_id
        FROM service_order_technicians sot
        JOIN users u ON u.id = sot.technician_id
        WHERE sot.service_order_id = so.id
          AND u.client_id IS NOT NULL
        ORDER BY (sot.released_at IS NULL) DESC, sot.role, sot.assigned_at
        LIMIT 1
      ) tp ON TRUE
      LEFT JOIN company_maintenance_type_sla_configs cfg
        ON  cfg.company_id       = so.company_id
        AND cfg.maintenance_type = so.maintenance_type
        AND cfg.priority         = so.priority
      -- Custo agregado por OS: juntar os itens direto multiplicava as linhas.
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(soci.total_price), 0) AS total
        FROM service_order_cost_items soci
        WHERE soci.service_order_id = so.id
      ) ci ON TRUE
      WHERE so.company_id  = ${companyId}
        AND so.deleted_at IS NULL
        AND so.status     <> 'CANCELLED'
        ${groupF}
    `
  }

  // ─────────────────────────────────────────
  // Comparativo entre prestadores no período
  // ─────────────────────────────────────────
  async getComparison(companyId: string, filters: ProvidersQueryDto) {
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)
    const cacheKey = `analytics:providers:comparison:${companyId}:${start.toISOString()}:${end.toISOString()}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      const now  = new Date()
      const base = this.providerOs(companyId, filters.groupId)

      const rows = await this.prisma.$queryRaw<Array<{
        provider_id:          string | null
        provider_name:        string | null
        provider_status:      string | null
        total:                number
        concluded:            number
        open:                 number
        corrective:           number
        preventive:           number
        other:                number
        sla_judged:           number
        sla_on_time:          number
        tpa_applicable:       number
        tpa_breached:         number
        prev_on_time:         number
        prev_late:            number
        prev_overdue:         number
        prev_within:          number
        first_time_fix:       number
        rejected:             number
        delivered:            number
        equipments:           number
        avg_response_hours:   number | null
        avg_resolution_hours: number | null
        avg_total_hours:      number | null
        total_cost:           number
      }>>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end})
        SELECT
          p.provider_id,
          c.name                                                                         AS provider_name,
          c.status::text                                                                 AS provider_status,
          COUNT(*)::int                                                                  AS total,
          COUNT(*) FILTER (WHERE p.concluded)::int                                       AS concluded,
          COUNT(*) FILTER (WHERE NOT p.concluded)::int                                   AS open,
          COUNT(*) FILTER (WHERE p.maintenance_type = 'CORRECTIVE')::int                 AS corrective,
          COUNT(*) FILTER (WHERE p.maintenance_type = 'PREVENTIVE')::int                 AS preventive,
          COUNT(*) FILTER (WHERE p.maintenance_type NOT IN ('CORRECTIVE', 'PREVENTIVE'))::int AS other,
          COUNT(*) FILTER (WHERE p.sla_status IN ('COMPLETED_ON_TIME', 'COMPLETED_LATE'))::int AS sla_judged,
          COUNT(*) FILTER (WHERE p.sla_status = 'COMPLETED_ON_TIME')::int                AS sla_on_time,
          COUNT(*) FILTER (WHERE p.sla_response_due_date IS NOT NULL)::int               AS tpa_applicable,
          COUNT(*) FILTER (WHERE p.sla_response_breached_at IS NOT NULL)::int            AS tpa_breached,
          COUNT(*) FILTER (WHERE p.prev_due_at IS NOT NULL AND p.concluded AND p.done_at <= p.prev_due_at)::int AS prev_on_time,
          COUNT(*) FILTER (WHERE p.prev_due_at IS NOT NULL AND p.concluded AND p.done_at >  p.prev_due_at)::int AS prev_late,
          COUNT(*) FILTER (WHERE p.prev_due_at IS NOT NULL AND NOT p.concluded AND p.prev_due_at <  ${now})::int AS prev_overdue,
          COUNT(*) FILTER (WHERE p.prev_due_at IS NOT NULL AND NOT p.concluded AND p.prev_due_at >= ${now})::int AS prev_within,
          COUNT(*) FILTER (WHERE p.concluded AND NOT p.has_child)::int                   AS first_time_fix,
          COUNT(*) FILTER (WHERE p.was_rejected)::int                                    AS rejected,
          -- Entregues para aprovação ao menos uma vez (concluídas ou já reprovadas).
          COUNT(*) FILTER (WHERE p.concluded OR p.was_rejected)::int                     AS delivered,
          COUNT(DISTINCT p.equipment_id)::int                                            AS equipments,
          ROUND(AVG(EXTRACT(EPOCH FROM (p.started_at - p.created_at)) / 3600.0)
            FILTER (WHERE p.started_at IS NOT NULL)::numeric, 1)::float8                 AS avg_response_hours,
          ROUND(AVG(EXTRACT(EPOCH FROM (p.done_at - p.started_at)) / 3600.0)
            FILTER (WHERE p.concluded AND p.started_at IS NOT NULL)::numeric, 1)::float8 AS avg_resolution_hours,
          ROUND(AVG(EXTRACT(EPOCH FROM (p.done_at - p.created_at)) / 3600.0)
            FILTER (WHERE p.concluded)::numeric, 1)::float8                              AS avg_total_hours,
          COALESCE(SUM(p.cost), 0)::float8                                               AS total_cost
        FROM p
        LEFT JOIN clients c ON c.id = p.provider_id
        GROUP BY p.provider_id, c.name, c.status
        ORDER BY total DESC
      `

      // Técnicos que atuaram nas OS de cada prestador no período.
      const techRows = await this.prisma.$queryRaw<Array<{ provider_id: string | null; technicians: number }>>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end})
        SELECT p.provider_id, COUNT(DISTINCT sot.technician_id)::int AS technicians
        FROM p
        JOIN service_order_technicians sot ON sot.service_order_id = p.id
        GROUP BY p.provider_id
      `
      const techMap = new Map(techRows.map(r => [r.provider_id ?? '', r.technicians]))

      const items = rows.map(r => {
        const prevJudged = r.prev_on_time + r.prev_late + r.prev_overdue
        return {
          providerId:        r.provider_id,
          providerName:      r.provider_id ? (r.provider_name ?? 'Prestador removido') : 'Equipe interna',
          isInternal:        r.provider_id == null,
          isActive:          r.provider_id == null || r.provider_status === 'ACTIVE',
          total:             r.total,
          concluded:         r.concluded,
          open:              r.open,
          byType: {
            corrective: r.corrective,
            preventive: r.preventive,
            other:      r.other,
          },
          technicians:       techMap.get(r.provider_id ?? '') ?? 0,
          equipments:        r.equipments,
          rates: {
            completionRate:     pct(r.concluded, r.total),
            slaComplianceRate:  pct(r.sla_on_time, r.sla_judged),
            tpaComplianceRate:  pct(r.tpa_applicable - r.tpa_breached, r.tpa_applicable),
            preventiveAdherence: pct(r.prev_on_time, prevJudged),
            firstTimeFixRate:   pct(r.first_time_fix, r.concluded),
            rejectionRate:      pct(r.rejected, r.delivered),
          },
          preventive: {
            onTime:         r.prev_on_time,
            late:           r.prev_late,
            overdueNow:     r.prev_overdue,
            withinDeadline: r.prev_within,
          },
          sla: {
            judged:        r.sla_judged,
            onTime:        r.sla_on_time,
            tpaApplicable: r.tpa_applicable,
            tpaBreached:   r.tpa_breached,
          },
          rejected:            r.rejected,
          avgResponseHours:    r.avg_response_hours,
          avgResolutionHours:  r.avg_resolution_hours,
          avgTotalHours:       r.avg_total_hours,
          totalCost:           r.total_cost,
          avgCostPerOs:        r.concluded > 0 ? Math.round((r.total_cost / r.concluded) * 100) / 100 : null,
        }
      })

      const providers = items.filter(i => !i.isInternal)
      const totalOs = items.reduce((s, i) => s + i.total, 0)
      const providerOs = providers.reduce((s, i) => s + i.total, 0)

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        summary: {
          providersWithOs: providers.length,
          totalOs,
          providerOs,
          providerShare:   pct(providerOs, totalOs),
          providerCost:    providers.reduce((s, i) => s + i.totalCost, 0),
        },
        items,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Evolução por prestador
  // ─────────────────────────────────────────
  async getTimeline(companyId: string, filters: ProvidersTimelineQueryDto) {
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)
    const granularity = filters.groupBy ?? pickGranularity(start, end)
    const cacheKey = `analytics:providers:timeline:${companyId}:${start.toISOString()}:${end.toISOString()}:${granularity}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      const base = this.providerOs(companyId, filters.groupId)
      const { unit, step, format } = granularityParts(granularity)

      // `opened` recorta pela abertura e `concluded` pela conclusão: entrada
      // vs vazão de cada prestador em cada intervalo.
      const rows = await this.prisma.$queryRaw<Array<{
        period:       string
        provider_id:  string | null
        opened:       number
        concluded:    number
        sla_judged:   number
        sla_on_time:  number
      }>>`
        WITH p AS (${base}),
        spine AS (
          SELECT generate_series(
            DATE_TRUNC(${unit}, ${start}::timestamptz),
            DATE_TRUNC(${unit}, ${end}::timestamptz),
            ${step}
          ) AS bucket
        ),
        providers AS (
          SELECT DISTINCT provider_id FROM p
          WHERE (created_at >= ${start} AND created_at <= ${end})
             OR (done_at    >= ${start} AND done_at    <= ${end})
        ),
        opened AS (
          SELECT DATE_TRUNC(${unit}, created_at) AS bucket, provider_id, COUNT(*)::int AS opened
          FROM p
          WHERE created_at >= ${start} AND created_at <= ${end}
          GROUP BY 1, 2
        ),
        closed AS (
          SELECT
            DATE_TRUNC(${unit}, done_at)                                                  AS bucket,
            provider_id,
            COUNT(*)::int                                                                 AS concluded,
            COUNT(*) FILTER (WHERE sla_status IN ('COMPLETED_ON_TIME', 'COMPLETED_LATE'))::int AS sla_judged,
            COUNT(*) FILTER (WHERE sla_status = 'COMPLETED_ON_TIME')::int                 AS sla_on_time
          FROM p
          WHERE concluded AND done_at >= ${start} AND done_at <= ${end}
          GROUP BY 1, 2
        )
        SELECT
          TO_CHAR(s.bucket, ${format})        AS period,
          pr.provider_id,
          COALESCE(o.opened, 0)::int          AS opened,
          COALESCE(c.concluded, 0)::int       AS concluded,
          COALESCE(c.sla_judged, 0)::int      AS sla_judged,
          COALESCE(c.sla_on_time, 0)::int     AS sla_on_time
        FROM spine s
        CROSS JOIN providers pr
        LEFT JOIN opened o ON o.bucket = s.bucket AND o.provider_id IS NOT DISTINCT FROM pr.provider_id
        LEFT JOIN closed c ON c.bucket = s.bucket AND c.provider_id IS NOT DISTINCT FROM pr.provider_id
        ORDER BY s.bucket ASC
      `

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        granularity,
        series: rows.map(r => ({
          period:            r.period,
          providerId:        r.provider_id,
          opened:            r.opened,
          concluded:         r.concluded,
          slaComplianceRate: pct(r.sla_on_time, r.sla_judged),
        })),
        generatedAt: new Date().toISOString(),
      }
    })
  }
}
