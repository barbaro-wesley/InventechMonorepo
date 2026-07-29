import { api } from '@/lib/api'
import type { CompanySlaConfig } from '../service-orders/service-orders.types'

export interface PreventiveSlaConfig {
  executionDays: number
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

  async getPreventiveSla(): Promise<PreventiveSlaConfig> {
    const { data } = await api.get<PreventiveSlaConfig>('/sla-configs/preventive')
    return data || { executionDays: 30 }
  },

  async updatePreventiveSla(executionDays: number): Promise<PreventiveSlaConfig> {
    const { data } = await api.put<PreventiveSlaConfig>('/sla-configs/preventive', { executionDays })
    return data || { executionDays }
  },
}
