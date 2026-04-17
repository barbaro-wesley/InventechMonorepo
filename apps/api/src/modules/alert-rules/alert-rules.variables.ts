import { EventType } from '@prisma/client'
import type { VariableDefinition } from '@inventech/shared-types'

export type { VariableDefinition }

export const EVENT_VARIABLE_REGISTRY: Record<EventType, VariableDefinition[]> = {
    [EventType.OS_CREATED_NO_TECHNICIAN]: [
        { key: 'osNumber',      label: 'Número da OS',   type: 'number' },
        { key: 'osTitle',       label: 'Título',          type: 'string' },
        { key: 'clientName',    label: 'Cliente',         type: 'string' },
        { key: 'equipmentName', label: 'Equipamento',     type: 'string' },
        { key: 'priority',      label: 'Prioridade',      type: 'string' },
        { key: 'groupName',     label: 'Grupo',           type: 'string' },
    ],
    [EventType.OS_TECHNICIAN_ASSIGNED]: [
        { key: 'osNumber',       label: 'Número da OS',   type: 'number' },
        { key: 'osTitle',        label: 'Título',          type: 'string' },
        { key: 'technicianName', label: 'Técnico',         type: 'string' },
        { key: 'clientName',     label: 'Cliente',         type: 'string' },
        { key: 'equipmentName',  label: 'Equipamento',     type: 'string' },
        { key: 'priority',       label: 'Prioridade',      type: 'string' },
        { key: 'scheduledFor',   label: 'Agendada para',   type: 'date' },
    ],
    [EventType.OS_TECHNICIAN_ASSUMED]: [
        { key: 'osNumber',       label: 'Número da OS',   type: 'number' },
        { key: 'osTitle',        label: 'Título',          type: 'string' },
        { key: 'technicianName', label: 'Técnico',         type: 'string' },
    ],
    [EventType.OS_COMPLETED]: [
        { key: 'osNumber',        label: 'Número da OS',  type: 'number' },
        { key: 'osTitle',         label: 'Título',         type: 'string' },
        { key: 'resolution',      label: 'Resolução',      type: 'string' },
        { key: 'technicianNames', label: 'Técnico(s)',     type: 'string' },
    ],
    [EventType.OS_APPROVED]: [
        { key: 'osNumber', label: 'Número da OS', type: 'number' },
        { key: 'osTitle',  label: 'Título',        type: 'string' },
    ],
    [EventType.OS_REJECTED]: [
        { key: 'osNumber', label: 'Número da OS', type: 'number' },
        { key: 'osTitle',  label: 'Título',        type: 'string' },
        { key: 'reason',   label: 'Motivo',        type: 'string' },
    ],
    [EventType.OS_UNASSIGNED_ALERT]: [
        { key: 'osNumber',      label: 'Número da OS',    type: 'number' },
        { key: 'osTitle',       label: 'Título',           type: 'string' },
        { key: 'clientName',    label: 'Cliente',          type: 'string' },
        { key: 'hoursWaiting',  label: 'Horas sem técnico', type: 'number' },
        { key: 'groupName',     label: 'Grupo',            type: 'string' },
    ],
    [EventType.EQUIPMENT_CREATED]: [
        { key: 'equipmentName', label: 'Equipamento',  type: 'string' },
        { key: 'brand',         label: 'Marca',         type: 'string' },
        { key: 'model',         label: 'Modelo',        type: 'string' },
        { key: 'locationName',  label: 'Localização',   type: 'string' },
        { key: 'clientName',    label: 'Cliente',        type: 'string' },
    ],
    [EventType.EQUIPMENT_MOVED]: [
        { key: 'equipmentName',   label: 'Equipamento',         type: 'string' },
        { key: 'fromLocation',    label: 'Localização anterior', type: 'string' },
        { key: 'toLocation',      label: 'Nova localização',     type: 'string' },
        { key: 'movedByName',     label: 'Movido por',           type: 'string' },
    ],
    [EventType.EQUIPMENT_WARRANTY_EXPIRING]: [
        { key: 'equipmentName', label: 'Equipamento',      type: 'string' },
        { key: 'brand',         label: 'Marca',             type: 'string' },
        { key: 'model',         label: 'Modelo',            type: 'string' },
        { key: 'warrantyEnd',   label: 'Vencimento',        type: 'date' },
        { key: 'daysRemaining', label: 'Dias restantes',    type: 'number' },
        { key: 'clientName',    label: 'Cliente',           type: 'string' },
    ],
    [EventType.PREVENTIVE_GENERATED]: [
        { key: 'osNumber',      label: 'Número da OS',  type: 'number' },
        { key: 'equipmentName', label: 'Equipamento',   type: 'string' },
        { key: 'groupName',     label: 'Grupo',         type: 'string' },
    ],
    [EventType.PREVENTIVE_UPCOMING]: [
        { key: 'daysAhead',    label: 'Dias de antecedência', type: 'number' },
        { key: 'count',        label: 'Qtd. de preventivas',  type: 'number' },
        { key: 'clientName',   label: 'Cliente',              type: 'string' },
        { key: 'equipmentName',label: 'Equipamento',          type: 'string' },
        { key: 'nextRunAt',    label: 'Data prevista',        type: 'date' },
        { key: 'groupName',    label: 'Grupo',                type: 'string' },
    ],
    [EventType.MAINTENANCE_OVERDUE]: [
        { key: 'equipmentName',    label: 'Equipamento',          type: 'string' },
        { key: 'maintenanceTitle', label: 'Título da manutenção', type: 'string' },
        { key: 'scheduledFor',     label: 'Prevista para',        type: 'date' },
        { key: 'daysOverdue',      label: 'Dias em atraso',       type: 'number' },
    ],
    [EventType.USER_CREATED]: [
        { key: 'userName',  label: 'Nome',  type: 'string' },
        { key: 'userEmail', label: 'Email', type: 'string' },
        { key: 'userRole',  label: 'Papel', type: 'string' },
    ],
    [EventType.USER_DEACTIVATED]: [
        { key: 'userName',  label: 'Nome',  type: 'string' },
        { key: 'userEmail', label: 'Email', type: 'string' },
        { key: 'userRole',  label: 'Papel', type: 'string' },
    ],
    [EventType.DAILY_SUMMARY]: [
        { key: 'companyName',           label: 'Empresa',                  type: 'string' },
        { key: 'date',                  label: 'Data',                     type: 'date' },
        { key: 'openCount',             label: 'OS no painel',             type: 'number' },
        { key: 'inProgressCount',       label: 'OS em andamento',          type: 'number' },
        { key: 'completedPendingCount', label: 'OS aguardando aprovação',  type: 'number' },
        { key: 'overdueCount',          label: 'OS com alerta',            type: 'number' },
    ],
}

// ─────────────────────────────────────────
// Interpola {{variáveis}} em uma string de template
// ─────────────────────────────────────────
export function interpolate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''))
}
