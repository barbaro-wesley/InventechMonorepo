import { Injectable, Inject } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../../common/providers/redis.provider'
import { DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS, SLA_PRIORITIES } from '../../sla/sla.service'
import { resolvePeriod, pickGranularity, granularityParts } from '../analytics-period.util'
import type {
  PreventiveAdherenceQueryDto,
  PreventiveBaseQueryDto,
  PreventiveRankingQueryDto,
  PreventiveTimelineQueryDto,
  PreventiveUpcomingQueryDto,
} from '../dto/analytics-preventive-query.dto'

const TTL = 300
const DAY_MS = 86_400_000

/** Prazo de conclusão padrão da preventiva (horas) quando a empresa não configurou. */
const DEFAULT_DEADLINE_HOURS = DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS.PREVENTIVE

/** Faixas de consumo do prazo configurado (tempo de execução / prazo). */
const DEADLINE_USAGE_BUCKETS = ['0-25', '25-50', '50-75', '75-100', '>100'] as const

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null)

@Injectable()
export class AnalyticsPreventiveService {
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

  private filterKey(f: PreventiveBaseQueryDto) {
    return `${f.clientId ?? ''}:${f.groupId ?? ''}:${f.equipmentId ?? ''}`
  }

  // ─────────────────────────────────────────
  // Base comum: OS preventivas com o prazo dos parâmetros
  //
  // A análise parte das OS preventivas (geradas pelo agendador ou avulsas), e
  // não de `maintenances.scheduled_at`: o gerador nunca preenche esse campo nem
  // o `completed_at` do registro de manutenção, então as consultas antigas
  // voltavam sempre zeradas.
  //
  // O atraso é medido pelo prazo de conclusão configurado em Parâmetros → SLA
  // por tipo de manutenção (linha PREVENTIVE, por prioridade), contado a partir
  // da abertura da OS — e não pelo `next_run_at` do agendamento, que o gerador
  // avança sozinho e por isso nunca indicava atraso real. Sem configuração
  // própria, vale o padrão do sistema (30 dias).
  //
  // Colunas expostas: id, number, title, status, priority, created_at,
  // started_at, done_at, equipment_id, client_id, group_id, schedule_id,
  // recurrence_type, deadline_hours, due_at, executed.
  // ─────────────────────────────────────────
  private preventiveOs(companyId: string, f: PreventiveBaseQueryDto) {
    const clientF = f.clientId    ? Prisma.sql`AND so.client_id    = ${f.clientId}`    : Prisma.empty
    const groupF  = f.groupId     ? Prisma.sql`AND so.group_id     = ${f.groupId}`     : Prisma.empty
    const equipF  = f.equipmentId ? Prisma.sql`AND so.equipment_id = ${f.equipmentId}` : Prisma.empty

    return Prisma.sql`
      SELECT
        so.id,
        so.number,
        so.title,
        so.status,
        so.priority,
        so.created_at,
        so.started_at,
        -- "Executada" = entregue pelo técnico (aguardando aprovação ou aprovada).
        -- completed_at pode faltar em OS legadas; updated_at cobre o buraco.
        CASE WHEN so.status IN ('COMPLETED', 'COMPLETED_APPROVED')
             THEN COALESCE(so.completed_at, so.updated_at)
        END                                                                        AS done_at,
        so.equipment_id,
        so.client_id,
        so.group_id,
        ms.id                                                                      AS schedule_id,
        ms.recurrence_type::text                                                   AS recurrence_type,
        COALESCE(cfg.max_resolution_hours, ${DEFAULT_DEADLINE_HOURS}::numeric)::float8 AS deadline_hours,
        so.created_at
          + COALESCE(cfg.max_resolution_hours, ${DEFAULT_DEADLINE_HOURS}::numeric)::float8
          * INTERVAL '1 hour'                                                      AS due_at,
        so.status IN ('COMPLETED', 'COMPLETED_APPROVED')                           AS executed
      FROM service_orders so
      LEFT JOIN maintenances          m   ON m.id  = so.maintenance_id
      LEFT JOIN maintenance_schedules ms  ON ms.id = m.schedule_id
      LEFT JOIN company_maintenance_type_sla_configs cfg
        ON  cfg.company_id       = so.company_id
        AND cfg.maintenance_type = so.maintenance_type
        AND cfg.priority         = so.priority
      WHERE so.company_id       = ${companyId}
        AND so.deleted_at      IS NULL
        AND so.maintenance_type = 'PREVENTIVE'
        AND so.status          <> 'CANCELLED'
        ${clientF}
        ${groupF}
        ${equipF}
    `
  }

  /** Prazo de conclusão da preventiva por prioridade, como está nos parâmetros. */
  private async getDeadlineConfig(companyId: string) {
    const rows = await this.prisma.companyMaintenanceTypeSla.findMany({
      where: { companyId, maintenanceType: 'PREVENTIVE' },
      select: { priority: true, maxResolutionHours: true },
    })
    const byPriority = new Map(rows.map(r => [r.priority, Number(r.maxResolutionHours)]))

    return SLA_PRIORITIES.map(priority => ({
      priority,
      hours:        byPriority.get(priority) ?? DEFAULT_DEADLINE_HOURS,
      isCustomized: byPriority.has(priority),
    }))
  }

  // ─────────────────────────────────────────
  // Taxa de aderência às preventivas
  // Base: OS preventivas abertas no período
  // ─────────────────────────────────────────
  async getAdherence(companyId: string, filters: PreventiveAdherenceQueryDto) {
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)
    const cacheKey = `analytics:prev:adherence:v2:${companyId}:${start.toISOString()}:${end.toISOString()}:${this.filterKey(filters)}`

    return this.cached(cacheKey, async () => {
      const now  = new Date()
      const base = this.preventiveOs(companyId, filters)

      type SummaryRow = {
        total:               number
        executed:            number
        on_time:             number
        late:                number
        not_executed:        number
        overdue_now:         number
        within_deadline:     number
        in_progress:         number
        avg_execution_hours: number | null
        avg_response_hours:  number | null
        avg_deadline_hours:  number | null
      }
      const [main] = await this.prisma.$queryRaw<SummaryRow[]>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end})
        SELECT
          COUNT(*)::int                                                               AS total,
          COUNT(*) FILTER (WHERE executed)::int                                       AS executed,
          COUNT(*) FILTER (WHERE executed AND done_at <= due_at)::int                 AS on_time,
          COUNT(*) FILTER (WHERE executed AND done_at >  due_at)::int                 AS late,
          COUNT(*) FILTER (WHERE NOT executed)::int                                   AS not_executed,
          COUNT(*) FILTER (WHERE NOT executed AND due_at <  ${now})::int              AS overdue_now,
          COUNT(*) FILTER (WHERE NOT executed AND due_at >= ${now})::int              AS within_deadline,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int                         AS in_progress,
          ROUND(AVG(EXTRACT(EPOCH FROM (done_at - created_at)) / 3600.0)
            FILTER (WHERE executed)::numeric, 1)::float8                              AS avg_execution_hours,
          ROUND(AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 3600.0)
            FILTER (WHERE started_at IS NOT NULL)::numeric, 1)::float8                AS avg_response_hours,
          ROUND(AVG(deadline_hours)::numeric, 1)::float8                              AS avg_deadline_hours
        FROM p
      `

      // Aderência por tipo de recorrência do agendamento. OS preventivas sem
      // agendamento (abertas manualmente) aparecem como AVULSA.
      const byRecurrence = await this.prisma.$queryRaw<Array<{
        recurrence_type: string
        total:           number
        executed:        number
        on_time:         number
        late:            number
        overdue_now:     number
        within_deadline: number
      }>>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end})
        SELECT
          COALESCE(recurrence_type, 'AVULSA')                                         AS recurrence_type,
          COUNT(*)::int                                                               AS total,
          COUNT(*) FILTER (WHERE executed)::int                                       AS executed,
          COUNT(*) FILTER (WHERE executed AND done_at <= due_at)::int                 AS on_time,
          COUNT(*) FILTER (WHERE executed AND done_at >  due_at)::int                 AS late,
          COUNT(*) FILTER (WHERE NOT executed AND due_at <  ${now})::int              AS overdue_now,
          COUNT(*) FILTER (WHERE NOT executed AND due_at >= ${now})::int              AS within_deadline
        FROM p
        GROUP BY 1
        ORDER BY total DESC
      `

      const byStatus = await this.prisma.$queryRaw<Array<{ status: string; total: number }>>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end})
        SELECT status::text AS status, COUNT(*)::int AS total
        FROM p
        GROUP BY 1
        ORDER BY total DESC
      `

      // Quanto do prazo configurado cada preventiva executada consumiu.
      // Mostra se a equipe entrega com folga ou "no limite".
      const usageRows = await this.prisma.$queryRaw<Array<{ bucket: string; total: number }>>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end}),
        ratios AS (
          SELECT EXTRACT(EPOCH FROM (done_at - created_at)) / 3600.0 / NULLIF(deadline_hours, 0) AS ratio
          FROM p
          WHERE executed
        )
        SELECT
          CASE
            WHEN ratio <= 0.25 THEN '0-25'
            WHEN ratio <= 0.50 THEN '25-50'
            WHEN ratio <= 0.75 THEN '50-75'
            WHEN ratio <= 1.00 THEN '75-100'
            ELSE '>100'
          END            AS bucket,
          COUNT(*)::int  AS total
        FROM ratios
        WHERE ratio IS NOT NULL
        GROUP BY 1
      `
      const usageMap = new Map(usageRows.map(r => [r.bucket, r.total]))

      // Aderência = executadas no prazo / preventivas com desfecho definido
      // (executadas + vencidas sem execução). OS ainda dentro do prazo não
      // entram no denominador — ainda podem ser cumpridas, e contá-las
      // derrubava a taxa de qualquer período recente.
      const judged = main.executed + main.overdue_now

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        deadlineConfig: await this.getDeadlineConfig(companyId),
        summary: {
          total:          main.total,
          executed:       main.executed,
          onTime:         main.on_time,
          late:           main.late,
          notExecuted:    main.not_executed,
          overdueNow:     main.overdue_now,
          withinDeadline: main.within_deadline,
          inProgress:     main.in_progress,
        },
        rates: {
          adherenceRate:  pct(main.on_time, judged),
          executionRate:  pct(main.executed, main.total),
          onTimeOfExecuted: pct(main.on_time, main.executed),
        },
        times: {
          avgExecutionHours: main.avg_execution_hours,
          avgResponseHours:  main.avg_response_hours,
          avgDeadlineHours:  main.avg_deadline_hours,
        },
        byRecurrence: byRecurrence.map(r => ({
          recurrenceType: r.recurrence_type,
          total:          r.total,
          executed:       r.executed,
          onTime:         r.on_time,
          late:           r.late,
          overdueNow:     r.overdue_now,
          withinDeadline: r.within_deadline,
          adherenceRate:  pct(r.on_time, r.executed + r.overdue_now),
          executionRate:  pct(r.executed, r.total),
        })),
        byStatus,
        deadlineUsage: DEADLINE_USAGE_BUCKETS.map(bucket => ({
          bucket,
          total: usageMap.get(bucket) ?? 0,
        })),
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Evolução das preventivas no período
  // ─────────────────────────────────────────
  async getTimeline(companyId: string, filters: PreventiveTimelineQueryDto) {
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)
    const granularity = filters.groupBy ?? pickGranularity(start, end)
    const cacheKey = `analytics:prev:timeline:${companyId}:${start.toISOString()}:${end.toISOString()}:${granularity}:${this.filterKey(filters)}`

    return this.cached(cacheKey, async () => {
      const now  = new Date()
      const base = this.preventiveOs(companyId, filters)
      const { unit, step, format } = granularityParts(granularity)

      // `generated` e o desfecho são recortados pela abertura da OS (coorte);
      // `executed` é recortado pela data de conclusão — é a vazão da equipe
      // em cada período, independente de quando a preventiva foi aberta.
      const rows = await this.prisma.$queryRaw<Array<{
        period:          string
        generated:       number
        on_time:         number
        late:            number
        overdue_now:     number
        within_deadline: number
        executed:        number
      }>>`
        WITH p AS (${base}),
        spine AS (
          SELECT generate_series(
            DATE_TRUNC(${unit}, ${start}::timestamptz),
            DATE_TRUNC(${unit}, ${end}::timestamptz),
            ${step}
          ) AS bucket
        ),
        opened AS (
          SELECT
            DATE_TRUNC(${unit}, created_at)                                           AS bucket,
            COUNT(*)::int                                                             AS generated,
            COUNT(*) FILTER (WHERE executed AND done_at <= due_at)::int               AS on_time,
            COUNT(*) FILTER (WHERE executed AND done_at >  due_at)::int               AS late,
            COUNT(*) FILTER (WHERE NOT executed AND due_at <  ${now})::int            AS overdue_now,
            COUNT(*) FILTER (WHERE NOT executed AND due_at >= ${now})::int            AS within_deadline
          FROM p
          WHERE created_at >= ${start} AND created_at <= ${end}
          GROUP BY 1
        ),
        closed AS (
          SELECT DATE_TRUNC(${unit}, done_at) AS bucket, COUNT(*)::int AS executed
          FROM p
          WHERE executed AND done_at >= ${start} AND done_at <= ${end}
          GROUP BY 1
        )
        SELECT
          TO_CHAR(s.bucket, ${format})           AS period,
          COALESCE(o.generated, 0)::int          AS generated,
          COALESCE(o.on_time, 0)::int            AS on_time,
          COALESCE(o.late, 0)::int               AS late,
          COALESCE(o.overdue_now, 0)::int        AS overdue_now,
          COALESCE(o.within_deadline, 0)::int    AS within_deadline,
          COALESCE(c.executed, 0)::int           AS executed
        FROM spine s
        LEFT JOIN opened o ON o.bucket = s.bucket
        LEFT JOIN closed c ON c.bucket = s.bucket
        ORDER BY s.bucket ASC
      `

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        granularity,
        series: rows.map(r => ({
          period:         r.period,
          generated:      r.generated,
          onTime:         r.on_time,
          late:           r.late,
          overdueNow:     r.overdue_now,
          withinDeadline: r.within_deadline,
          executed:       r.executed,
          adherenceRate:  pct(r.on_time, r.on_time + r.late + r.overdue_now),
        })),
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Preventivas por técnico
  // ─────────────────────────────────────────
  async getByTechnician(companyId: string, filters: PreventiveRankingQueryDto) {
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)
    const limit = filters.limit ?? 15
    const cacheKey = `analytics:prev:technicians:${companyId}:${start.toISOString()}:${end.toISOString()}:${limit}:${this.filterKey(filters)}`

    return this.cached(cacheKey, async () => {
      const now  = new Date()
      const base = this.preventiveOs(companyId, filters)

      // Cada técnico vinculado à OS recebe o crédito dela (líder ou auxiliar).
      const rows = await this.prisma.$queryRaw<Array<{
        technician_id:       string
        technician_name:     string
        total:               number
        executed:            number
        on_time:             number
        late:                number
        overdue_now:         number
        avg_execution_hours: number | null
      }>>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end})
        SELECT
          u.id                                                                        AS technician_id,
          u.name                                                                      AS technician_name,
          COUNT(DISTINCT p.id)::int                                                   AS total,
          COUNT(DISTINCT p.id) FILTER (WHERE p.executed)::int                         AS executed,
          COUNT(DISTINCT p.id) FILTER (WHERE p.executed AND p.done_at <= p.due_at)::int AS on_time,
          COUNT(DISTINCT p.id) FILTER (WHERE p.executed AND p.done_at >  p.due_at)::int AS late,
          COUNT(DISTINCT p.id) FILTER (WHERE NOT p.executed AND p.due_at < ${now})::int AS overdue_now,
          ROUND(AVG(EXTRACT(EPOCH FROM (p.done_at - p.created_at)) / 3600.0)
            FILTER (WHERE p.executed)::numeric, 1)::float8                            AS avg_execution_hours
        FROM p
        JOIN service_order_technicians sot ON sot.service_order_id = p.id
        JOIN users                     u   ON u.id = sot.technician_id
        GROUP BY u.id, u.name
        ORDER BY executed DESC, total DESC
        LIMIT ${limit}
      `

      const [unassigned] = await this.prisma.$queryRaw<[{ total: number; overdue_now: number }]>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end})
        SELECT
          COUNT(*)::int                                                               AS total,
          COUNT(*) FILTER (WHERE NOT p.executed AND p.due_at < ${now})::int           AS overdue_now
        FROM p
        WHERE NOT EXISTS (
          SELECT 1 FROM service_order_technicians sot WHERE sot.service_order_id = p.id
        )
      `

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        items: rows.map(r => ({
          technicianId:      r.technician_id,
          technicianName:    r.technician_name,
          total:             r.total,
          executed:          r.executed,
          onTime:            r.on_time,
          late:              r.late,
          overdueNow:        r.overdue_now,
          avgExecutionHours: r.avg_execution_hours,
          adherenceRate:     pct(r.on_time, r.executed + r.overdue_now),
        })),
        unassigned: {
          total:      unassigned?.total ?? 0,
          overdueNow: unassigned?.overdue_now ?? 0,
        },
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Preventivas por tipo de equipamento
  // ─────────────────────────────────────────
  async getByEquipmentType(companyId: string, filters: PreventiveRankingQueryDto) {
    const { start, end } = resolvePeriod(filters.startDate, filters.endDate)
    const limit = filters.limit ?? 10
    const cacheKey = `analytics:prev:equip-types:${companyId}:${start.toISOString()}:${end.toISOString()}:${limit}:${this.filterKey(filters)}`

    return this.cached(cacheKey, async () => {
      const now  = new Date()
      const base = this.preventiveOs(companyId, filters)

      const rows = await this.prisma.$queryRaw<Array<{
        type_name:   string
        total:       number
        executed:    number
        on_time:     number
        late:        number
        overdue_now: number
      }>>`
        WITH p AS (${base} AND so.created_at >= ${start} AND so.created_at <= ${end})
        SELECT
          COALESCE(et.name, 'Sem tipo')                                               AS type_name,
          COUNT(*)::int                                                               AS total,
          COUNT(*) FILTER (WHERE p.executed)::int                                     AS executed,
          COUNT(*) FILTER (WHERE p.executed AND p.done_at <= p.due_at)::int           AS on_time,
          COUNT(*) FILTER (WHERE p.executed AND p.done_at >  p.due_at)::int           AS late,
          COUNT(*) FILTER (WHERE NOT p.executed AND p.due_at < ${now})::int           AS overdue_now
        FROM p
        JOIN equipments           e  ON e.id  = p.equipment_id
        LEFT JOIN equipment_types et ON et.id = e.type_id
        GROUP BY 1
        ORDER BY total DESC
        LIMIT ${limit}
      `

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        items: rows.map(r => ({
          typeName:      r.type_name,
          total:         r.total,
          executed:      r.executed,
          onTime:        r.on_time,
          late:          r.late,
          overdueNow:    r.overdue_now,
          adherenceRate: pct(r.on_time, r.executed + r.overdue_now),
        })),
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Próximas preventivas agendadas
  // ─────────────────────────────────────────
  async getUpcoming(companyId: string, filters: PreventiveUpcomingQueryDto) {
    const daysAhead = filters.daysAhead ?? 30
    const limit     = filters.limit ?? 50

    const clientF = filters.clientId    ? Prisma.sql`AND ms.client_id     = ${filters.clientId}`    : Prisma.empty
    const groupF  = filters.groupId     ? Prisma.sql`AND ms.group_id      = ${filters.groupId}`     : Prisma.empty
    const equipF  = filters.equipmentId ? Prisma.sql`AND ms.equipment_id  = ${filters.equipmentId}` : Prisma.empty

    const cacheKey = `analytics:prev:upcoming:${companyId}:${daysAhead}:${limit}:${this.filterKey(filters)}`

    return this.cached(cacheKey, async () => {
      const now   = new Date()
      const until = new Date(now.getTime() + daysAhead * DAY_MS)

      const whereSql = Prisma.sql`
        WHERE ms.company_id       = ${companyId}
          AND ms.is_active        = true
          AND ms.maintenance_type = 'PREVENTIVE'
          AND ms.next_run_at     >= ${now}
          AND ms.next_run_at     <= ${until}
          AND (ms.end_date IS NULL OR ms.end_date >= ms.next_run_at::date)
          ${clientF}
          ${groupF}
          ${equipF}
      `

      const [rows, [countRow]] = await Promise.all([
        this.prisma.$queryRaw<Array<{
          id:                 string
          title:              string
          maintenance_type:   string
          recurrence_type:    string
          next_run_at:        Date
          equipment_id:       string
          equipment_name:     string
          equipment_serial:   string | null
          type_name:          string | null
          location_name:      string | null
          client_name:        string | null
          group_name:         string | null
          technician_name:    string | null
        }>>`
          SELECT
            ms.id,
            ms.title,
            ms.maintenance_type,
            ms.recurrence_type,
            ms.next_run_at,
            e.id                                               AS equipment_id,
            e.name                                             AS equipment_name,
            e.serial_number                                    AS equipment_serial,
            et.name                                            AS type_name,
            l.name                                             AS location_name,
            c.name                                             AS client_name,
            mg.name                                            AS group_name,
            u.name                                             AS technician_name
          FROM maintenance_schedules ms
          JOIN equipments             e    ON e.id   = ms.equipment_id
          LEFT JOIN equipment_types   et   ON et.id  = e.type_id
          LEFT JOIN locations         l    ON l.id   = e.current_location_id
          LEFT JOIN clients           c    ON c.id   = ms.client_id
          LEFT JOIN maintenance_groups mg  ON mg.id  = ms.group_id
          LEFT JOIN users             u    ON u.id   = ms.assigned_technician_id
          ${whereSql}
          ORDER BY ms.next_run_at ASC
          LIMIT ${limit}
        `,
        // Total sem o LIMIT: o card mostrava o tamanho da página, não o total.
        this.prisma.$queryRaw<[{ total: number }]>`
          SELECT COUNT(*)::int AS total
          FROM maintenance_schedules ms
          ${whereSql}
        `,
      ])

      return {
        daysAhead,
        count: countRow?.total ?? rows.length,
        items: rows.map(r => ({ ...r, days_until: Math.floor((r.next_run_at.getTime() - now.getTime()) / DAY_MS) })),
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Preventivas atrasadas
  // OS preventiva ainda não executada cujo prazo de conclusão configurado nos
  // parâmetros (contado da abertura da OS) já venceu. Retrato atual — não
  // depende do período selecionado.
  // ─────────────────────────────────────────
  async getOverdue(companyId: string, filters: PreventiveBaseQueryDto) {
    const cacheKey = `analytics:prev:overdue:v2:${companyId}:${this.filterKey(filters)}`

    return this.cached(cacheKey, async () => {
      const now  = new Date()
      const base = this.preventiveOs(companyId, filters)

      const raw = await this.prisma.$queryRaw<Array<{
        id:               string
        number:           number
        title:            string
        status:           string
        priority:         string
        recurrence_type:  string | null
        created_at:       Date
        due_at:           Date
        deadline_hours:   number
        equipment_id:     string
        equipment_name:   string
        equipment_serial: string | null
        criticality:      string
        type_name:        string | null
        location_name:    string | null
        client_name:      string | null
        group_name:       string | null
        technician_name:  string | null
      }>>`
        WITH p AS (${base})
        SELECT
          p.id,
          p.number,
          p.title,
          p.status::text                                                          AS status,
          p.priority::text                                                        AS priority,
          p.recurrence_type,
          p.created_at,
          p.due_at,
          p.deadline_hours,
          e.id                                                                    AS equipment_id,
          e.name                                                                  AS equipment_name,
          e.serial_number                                                         AS equipment_serial,
          e.criticality::text                                                     AS criticality,
          et.name                                                                 AS type_name,
          l.name                                                                  AS location_name,
          c.name                                                                  AS client_name,
          mg.name                                                                 AS group_name,
          tech.names                                                              AS technician_name
        FROM p
        JOIN equipments              e   ON e.id  = p.equipment_id
        LEFT JOIN equipment_types    et  ON et.id = e.type_id
        LEFT JOIN locations          l   ON l.id  = e.current_location_id
        LEFT JOIN clients            c   ON c.id  = p.client_id
        LEFT JOIN maintenance_groups mg  ON mg.id = p.group_id
        LEFT JOIN LATERAL (
          SELECT STRING_AGG(u.name, ', ' ORDER BY sot.role, u.name) AS names
          FROM service_order_technicians sot
          JOIN users u ON u.id = sot.technician_id
          WHERE sot.service_order_id = p.id
        ) tech ON TRUE
        WHERE NOT p.executed
          AND p.due_at < ${now}
        ORDER BY p.due_at ASC
      `
      const rows = raw.map(r => ({
        ...r,
        days_overdue: Math.floor((now.getTime() - r.due_at.getTime()) / DAY_MS),
      }))

      // Totalizadores por criticidade e por faixa de atraso sobre o conjunto
      // completo; a lista devolvida é limitada.
      const byCriticality: Record<string, number> = {}
      const byDelay = { upTo7: 0, upTo30: 0, upTo90: 0, over90: 0 }
      for (const r of rows) {
        byCriticality[r.criticality] = (byCriticality[r.criticality] ?? 0) + 1
        if (r.days_overdue <= 7)       byDelay.upTo7++
        else if (r.days_overdue <= 30) byDelay.upTo30++
        else if (r.days_overdue <= 90) byDelay.upTo90++
        else                           byDelay.over90++
      }

      return {
        count:         rows.length,
        byCriticality,
        byDelay,
        items:         rows.slice(0, 200),
        generatedAt:   new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Resumo de agendas ativas por recorrência
  // ─────────────────────────────────────────
  async getByRecurrence(companyId: string, filters: PreventiveBaseQueryDto) {
    const clientF = filters.clientId    ? Prisma.sql`AND ms.client_id    = ${filters.clientId}`    : Prisma.empty
    const groupF  = filters.groupId     ? Prisma.sql`AND ms.group_id     = ${filters.groupId}`     : Prisma.empty
    const equipF  = filters.equipmentId ? Prisma.sql`AND ms.equipment_id = ${filters.equipmentId}` : Prisma.empty

    const cacheKey = `analytics:prev:recurrence:v2:${companyId}:${this.filterKey(filters)}`

    return this.cached(cacheKey, async () => {
      const now  = new Date()
      const base = this.preventiveOs(companyId, {})
      const in7Days  = new Date(now.getTime() + 7  * DAY_MS)
      const in30Days = new Date(now.getTime() + 30 * DAY_MS)

      // "Atrasada" = agenda com OS preventiva em aberto além do prazo dos
      // parâmetros, e não next_run_at no passado (o gerador avança essa data
      // sozinho, então ela não indica atraso de execução).
      const rows = await this.prisma.$queryRaw<Array<{
        recurrence_type: string
        total:           number
        overdue:         number
        due_this_week:   number
        due_this_month:  number
      }>>`
        WITH overdue_os AS (
          SELECT DISTINCT p.schedule_id
          FROM (${base}) p
          WHERE p.schedule_id IS NOT NULL
            AND NOT p.executed
            AND p.due_at < ${now}
        )
        SELECT
          ms.recurrence_type::text                                                              AS recurrence_type,
          COUNT(*)::int                                                                         AS total,
          COUNT(*) FILTER (WHERE oo.schedule_id IS NOT NULL)::int                               AS overdue,
          COUNT(*) FILTER (WHERE ms.next_run_at >= ${now}
            AND ms.next_run_at <= ${in7Days})::int                                             AS due_this_week,
          COUNT(*) FILTER (WHERE ms.next_run_at >= ${now}
            AND ms.next_run_at <= ${in30Days})::int                                            AS due_this_month
        FROM maintenance_schedules ms
        LEFT JOIN overdue_os oo ON oo.schedule_id = ms.id
        WHERE ms.company_id       = ${companyId}
          AND ms.is_active        = true
          AND ms.maintenance_type = 'PREVENTIVE'
          ${clientF}
          ${groupF}
          ${equipF}
        GROUP BY ms.recurrence_type
        ORDER BY total DESC
      `

      const total = rows.reduce((s, r) => s + r.total, 0)

      return {
        total,
        byRecurrence: rows,
        generatedAt: new Date().toISOString(),
      }
    })
  }

}
