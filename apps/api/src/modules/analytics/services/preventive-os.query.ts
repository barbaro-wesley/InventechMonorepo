import { Prisma } from '@prisma/client'
import { DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS } from '../../sla/sla.service'

export interface PreventiveOsScope {
  clientId?: string
  groupId?: string
  equipmentId?: string
}

const DEFAULT_DEADLINE_HOURS = DEFAULT_MAINTENANCE_TYPE_RESOLUTION_HOURS.PREVENTIVE

export function preventiveOsQuery(companyId: string, f: PreventiveOsScope) {
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
