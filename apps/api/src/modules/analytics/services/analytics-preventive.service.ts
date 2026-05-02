import { Injectable, Inject } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import Redis from 'ioredis'
import { PrismaService } from '../../../prisma/prisma.service'
import { REDIS_CLIENT } from '../../../common/providers/redis.provider'
import type {
  PreventiveAdherenceQueryDto,
  PreventiveBaseQueryDto,
  PreventiveUpcomingQueryDto,
} from '../dto/analytics-preventive-query.dto'

const TTL = 300

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

  // ─────────────────────────────────────────
  // Taxa de aderência às preventivas
  // Base: registros de Maintenance com scheduleId (gerados pelo agendador)
  // ─────────────────────────────────────────
  async getAdherence(companyId: string, filters: PreventiveAdherenceQueryDto) {
    const start = filters.startDate ? new Date(filters.startDate) : this.startOfYear()
    const end   = filters.endDate   ? new Date(filters.endDate)   : new Date()

    const clientF = filters.clientId ? Prisma.sql`AND m.client_id    = ${filters.clientId}::uuid`    : Prisma.empty
    const groupF  = filters.groupId  ? Prisma.sql`AND ms.group_id    = ${filters.groupId}::uuid`     : Prisma.empty
    const equipF  = filters.equipmentId ? Prisma.sql`AND m.equipment_id = ${filters.equipmentId}::uuid` : Prisma.empty

    const cacheKey = `analytics:prev:adherence:${companyId}:${start.toISOString()}:${end.toISOString()}:${filters.clientId ?? ''}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      // Métricas globais baseadas nos registros de manutenção gerados
      type AdherenceRow = {
        total:        number
        executed:     number
        on_time:      number
        late:         number
        not_executed: number
        overdue_now:  number
      }
      const [main] = await this.prisma.$queryRaw<AdherenceRow[]>`
        SELECT
          COUNT(*)::int                                                                  AS total,
          COUNT(*) FILTER (WHERE m.completed_at IS NOT NULL)::int                       AS executed,
          COUNT(*) FILTER (
            WHERE m.completed_at IS NOT NULL
              AND m.completed_at <= m.scheduled_at + INTERVAL '1 day'
          )::int                                                                         AS on_time,
          COUNT(*) FILTER (
            WHERE m.completed_at IS NOT NULL
              AND m.completed_at > m.scheduled_at + INTERVAL '1 day'
          )::int                                                                         AS late,
          COUNT(*) FILTER (WHERE m.completed_at IS NULL)::int                           AS not_executed,
          COUNT(*) FILTER (
            WHERE m.completed_at IS NULL
              AND m.scheduled_at < NOW()
          )::int                                                                         AS overdue_now
        FROM maintenances m
        JOIN maintenance_schedules ms ON ms.id = m.schedule_id
        WHERE m.company_id    = ${companyId}
          AND m.schedule_id  IS NOT NULL
          AND m.scheduled_at >= ${start}
          AND m.scheduled_at <= ${end}
          ${clientF}
          ${groupF}
          ${equipF}
      `

      // Aderência geral por tipo de recorrência no período
      const byRecurrence = await this.prisma.$queryRaw<Array<{
        recurrence_type: string
        total:           number
        executed:        number
        on_time:         number
        overdue_now:     number
      }>>`
        SELECT
          ms.recurrence_type,
          COUNT(*)::int                                                                  AS total,
          COUNT(*) FILTER (WHERE m.completed_at IS NOT NULL)::int                       AS executed,
          COUNT(*) FILTER (
            WHERE m.completed_at IS NOT NULL
              AND m.completed_at <= m.scheduled_at + INTERVAL '1 day'
          )::int                                                                         AS on_time,
          COUNT(*) FILTER (
            WHERE m.completed_at IS NULL AND m.scheduled_at < NOW()
          )::int                                                                         AS overdue_now
        FROM maintenances m
        JOIN maintenance_schedules ms ON ms.id = m.schedule_id
        WHERE m.company_id    = ${companyId}
          AND m.schedule_id  IS NOT NULL
          AND m.scheduled_at >= ${start}
          AND m.scheduled_at <= ${end}
          ${clientF}
          ${groupF}
          ${equipF}
        GROUP BY ms.recurrence_type
        ORDER BY total DESC
      `

      const adherenceRate  = main.total > 0 ? Math.round((main.on_time  / main.total) * 100) : null
      const executionRate  = main.total > 0 ? Math.round((main.executed / main.total) * 100) : null

      return {
        period: { start: start.toISOString(), end: end.toISOString() },
        summary: {
          total:        main.total,
          executed:     main.executed,
          onTime:       main.on_time,
          late:         main.late,
          notExecuted:  main.not_executed,
          overdueNow:   main.overdue_now,
        },
        rates: {
          adherenceRate,
          executionRate,
        },
        byRecurrence: byRecurrence.map(r => ({
          recurrenceType: r.recurrence_type,
          total:          r.total,
          executed:       r.executed,
          onTime:         r.on_time,
          overdueNow:     r.overdue_now,
          adherenceRate:  r.total > 0 ? Math.round((r.on_time  / r.total) * 100) : null,
          executionRate:  r.total > 0 ? Math.round((r.executed / r.total) * 100) : null,
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
    const until     = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)

    const clientF = filters.clientId    ? Prisma.sql`AND ms.client_id     = ${filters.clientId}::uuid`    : Prisma.empty
    const groupF  = filters.groupId     ? Prisma.sql`AND ms.group_id      = ${filters.groupId}::uuid`     : Prisma.empty
    const equipF  = filters.equipmentId ? Prisma.sql`AND ms.equipment_id  = ${filters.equipmentId}::uuid` : Prisma.empty

    const cacheKey = `analytics:prev:upcoming:${companyId}:${daysAhead}:${filters.clientId ?? ''}:${filters.groupId ?? ''}:${filters.equipmentId ?? ''}`

    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.$queryRaw<Array<{
        id:                 string
        title:              string
        maintenance_type:   string
        recurrence_type:    string
        next_run_at:        Date
        days_until:         number
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
          EXTRACT(DAY FROM (ms.next_run_at - NOW()))::int   AS days_until,
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
        WHERE ms.company_id  = ${companyId}
          AND ms.is_active   = true
          AND ms.next_run_at >= NOW()
          AND ms.next_run_at <= ${until}
          ${clientF}
          ${groupF}
          ${equipF}
        ORDER BY ms.next_run_at ASC
        LIMIT ${limit}
      `

      return {
        daysAhead,
        count: rows.length,
        items: rows,
        generatedAt: new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Preventivas atrasadas (nextRunAt < agora)
  // ─────────────────────────────────────────
  async getOverdue(companyId: string, filters: PreventiveBaseQueryDto) {
    const clientF = filters.clientId    ? Prisma.sql`AND ms.client_id    = ${filters.clientId}::uuid`    : Prisma.empty
    const groupF  = filters.groupId     ? Prisma.sql`AND ms.group_id     = ${filters.groupId}::uuid`     : Prisma.empty
    const equipF  = filters.equipmentId ? Prisma.sql`AND ms.equipment_id = ${filters.equipmentId}::uuid` : Prisma.empty

    const cacheKey = `analytics:prev:overdue:${companyId}:${filters.clientId ?? ''}:${filters.groupId ?? ''}:${filters.equipmentId ?? ''}`

    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.$queryRaw<Array<{
        id:               string
        title:            string
        maintenance_type: string
        recurrence_type:  string
        next_run_at:      Date
        days_overdue:     number
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
        SELECT
          ms.id,
          ms.title,
          ms.maintenance_type,
          ms.recurrence_type,
          ms.next_run_at,
          GREATEST(EXTRACT(DAY FROM (NOW() - ms.next_run_at))::int, 0) AS days_overdue,
          e.id                                                           AS equipment_id,
          e.name                                                         AS equipment_name,
          e.serial_number                                                AS equipment_serial,
          e.criticality,
          et.name                                                        AS type_name,
          l.name                                                         AS location_name,
          c.name                                                         AS client_name,
          mg.name                                                        AS group_name,
          u.name                                                         AS technician_name
        FROM maintenance_schedules ms
        JOIN equipments             e    ON e.id   = ms.equipment_id
        LEFT JOIN equipment_types   et   ON et.id  = e.type_id
        LEFT JOIN locations         l    ON l.id   = e.current_location_id
        LEFT JOIN clients           c    ON c.id   = ms.client_id
        LEFT JOIN maintenance_groups mg  ON mg.id  = ms.group_id
        LEFT JOIN users             u    ON u.id   = ms.assigned_technician_id
        WHERE ms.company_id  = ${companyId}
          AND ms.is_active   = true
          AND ms.next_run_at < NOW()
          ${clientF}
          ${groupF}
          ${equipF}
        ORDER BY ms.next_run_at ASC
        LIMIT 200
      `

      // Totalizadores por criticidade do equipamento
      const byCriticality: Record<string, number> = {}
      for (const r of rows) {
        byCriticality[r.criticality] = (byCriticality[r.criticality] ?? 0) + 1
      }

      return {
        count:         rows.length,
        byCriticality,
        items:         rows,
        generatedAt:   new Date().toISOString(),
      }
    })
  }

  // ─────────────────────────────────────────
  // Resumo de agendas ativas por recorrência
  // ─────────────────────────────────────────
  async getByRecurrence(companyId: string, filters: PreventiveBaseQueryDto) {
    const clientF = filters.clientId    ? Prisma.sql`AND ms.client_id    = ${filters.clientId}::uuid`    : Prisma.empty
    const groupF  = filters.groupId     ? Prisma.sql`AND ms.group_id     = ${filters.groupId}::uuid`     : Prisma.empty
    const equipF  = filters.equipmentId ? Prisma.sql`AND ms.equipment_id = ${filters.equipmentId}::uuid` : Prisma.empty

    const cacheKey = `analytics:prev:recurrence:${companyId}:${filters.clientId ?? ''}:${filters.groupId ?? ''}`

    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.$queryRaw<Array<{
        recurrence_type: string
        total:           number
        overdue:         number
        due_this_week:   number
        due_this_month:  number
      }>>`
        SELECT
          ms.recurrence_type,
          COUNT(*)::int                                                                         AS total,
          COUNT(*) FILTER (WHERE ms.next_run_at < NOW())::int                                  AS overdue,
          COUNT(*) FILTER (WHERE ms.next_run_at >= NOW()
            AND ms.next_run_at <= NOW() + INTERVAL '7 days')::int                              AS due_this_week,
          COUNT(*) FILTER (WHERE ms.next_run_at >= NOW()
            AND ms.next_run_at <= NOW() + INTERVAL '30 days')::int                             AS due_this_month
        FROM maintenance_schedules ms
        WHERE ms.company_id = ${companyId}
          AND ms.is_active  = true
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

  private startOfYear(): Date {
    const d = new Date()
    d.setMonth(0, 1)
    d.setHours(0, 0, 0, 0)
    return d
  }
}
