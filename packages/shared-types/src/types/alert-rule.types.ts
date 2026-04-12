import type { EventType } from '../enums/alert-rule.enum'
import type { NotificationChannel } from '../enums/notification.enum'

export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in'

export interface AlertRuleCondition {
  field: string
  operator: ConditionOperator
  value: string | number | boolean | string[]
}

export interface VariableDefinition {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'date'
}

export interface AlertRule {
  id: string
  companyId: string
  createdById: string
  name: string
  description?: string | null
  isActive: boolean
  triggerEvent: EventType
  conditions: AlertRuleCondition[]
  headerColor: string
  headerTitle: string
  bodyTemplate: string
  tableFields: string[]
  buttonLabel?: string | null
  buttonUrlTemplate?: string | null
  footerNote?: string | null
  recipientRoles: string[]
  recipientGroupIds: string[]
  recipientUserIds: string[]
  channels: NotificationChannel[]
  fireCount: number
  lastFiredAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAlertRuleDto {
  name: string
  description?: string
  isActive?: boolean
  triggerEvent: EventType
  conditions?: AlertRuleCondition[]
  headerColor?: string
  headerTitle: string
  bodyTemplate: string
  tableFields?: string[]
  buttonLabel?: string
  buttonUrlTemplate?: string
  footerNote?: string
  recipientRoles?: string[]
  recipientGroupIds?: string[]
  recipientUserIds?: string[]
  channels: NotificationChannel[]
}

export interface UpdateAlertRuleDto extends Partial<CreateAlertRuleDto> {}

export interface ListAlertRulesParams {
  page?: number
  limit?: number
  search?: string
  triggerEvent?: EventType
  isActive?: boolean
}
