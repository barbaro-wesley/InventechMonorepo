import { EventType } from '@inventech/shared-types'

// ─────────────────────────────────────────
// Fila de notificações
// ─────────────────────────────────────────
export const NOTIFICATION_QUEUE = 'notifications'

// ─────────────────────────────────────────
// Re-exporta EventType como fonte única de verdade
// ─────────────────────────────────────────
export { EventType }
export type NotificationEvent = EventType

// ─────────────────────────────────────────
// Quem recebe cada evento (eventos fixos do sistema)
// ─────────────────────────────────────────
export const EVENT_RECIPIENTS = {
    [EventType.OS_CREATED_NO_TECHNICIAN]: ['group_technicians', 'company_managers'],
    [EventType.OS_TECHNICIAN_ASSIGNED]:   ['technician'],
    [EventType.OS_TECHNICIAN_ASSUMED]:    ['requester', 'company_managers'],
    [EventType.OS_COMPLETED]:             ['requester', 'company_managers', 'client_admins'],
    [EventType.OS_APPROVED]:             ['technicians'],
    [EventType.OS_REJECTED]:             ['technicians', 'company_managers'],
    [EventType.OS_UNASSIGNED_ALERT]:     ['group_technicians', 'company_managers'],
    [EventType.PREVENTIVE_GENERATED]:    ['company_managers', 'group_technicians'],
    [EventType.DAILY_SUMMARY]:           ['company_admins', 'company_managers'],
} as const
