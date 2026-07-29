import { api } from '@/lib/api'
import type {
  CompanySlaConfig,
  MaintenanceType,
  ServiceOrderPriority,
} from '../service-orders/service-orders.types'

export interface PreventiveSlaConfig {
  executionDays: number
}

/** Tipos com SLA próprio. Corretiva não entra: usa CompanySlaConfig. */
export type SlaConfigurableMaintenanceType = Exclude<MaintenanceType, 'CORRECTIVE'>

/**
 * Uma célula da matriz (tipo × prioridade).
 * Prazos sempre em HORAS — a UI converte para dias na exibição.
 */
export interface MaintenanceTypeSlaConfig {
  maintenanceType: SlaConfigurableMaintenanceType
  priority: ServiceOrderPriority
  maxResponseHours: number | null
  maxResolutionHours: number
  isCustomized?: boolean
}

export const slaService = {
  async getSlaConfigs(): Promise<CompanySlaConfig[]> {
    const { data } = await api.get<CompanySlaConfig[]>('/sla-configs')
    return data || []
  },

  async updateSlaConfigs(configs: CompanySlaConfig[]): Promise<CompanySlaConfig[]> {
    const { data } = await api.put<CompanySlaConfig[]>('/sla-configs', { configs })
    return data || []
  },

  async getMaintenanceTypeSlaConfigs(): Promise<MaintenanceTypeSlaConfig[]> {
    const { data } = await api.get<MaintenanceTypeSlaConfig[]>('/sla-configs/maintenance-types')
    return data || []
  },

  async updateMaintenanceTypeSlaConfigs(
    configs: MaintenanceTypeSlaConfig[],
  ): Promise<MaintenanceTypeSlaConfig[]> {
    const { data } = await api.put<MaintenanceTypeSlaConfig[]>('/sla-configs/maintenance-types', {
      configs: configs.map((c) => ({
        maintenanceType: c.maintenanceType,
        priority: c.priority,
        maxResponseHours: c.maxResponseHours,
        maxResolutionHours: c.maxResolutionHours,
      })),
    })
    return data || []
  },

  /** @deprecated Use getMaintenanceTypeSlaConfigs. */
  async getPreventiveSla(): Promise<PreventiveSlaConfig> {
    const { data } = await api.get<PreventiveSlaConfig>('/sla-configs/preventive')
    return data || { executionDays: 30 }
  },

  async updatePreventiveSla(executionDays: number): Promise<PreventiveSlaConfig> {
    const { data } = await api.put<PreventiveSlaConfig>('/sla-configs/preventive', { executionDays })
    return data || { executionDays }
  },
}
