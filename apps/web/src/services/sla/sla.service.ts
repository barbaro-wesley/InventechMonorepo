import { api } from '@/lib/api'
import type { CompanySlaConfig } from '../service-orders/service-orders.types'

export const slaService = {
  async getSlaConfigs(): Promise<CompanySlaConfig[]> {
    const { data } = await api.get<CompanySlaConfig[]>('/sla-configs')
    return data || []
  },

  async updateSlaConfigs(configs: CompanySlaConfig[]): Promise<CompanySlaConfig[]> {
    const { data } = await api.put<CompanySlaConfig[]>('/sla-configs', { configs })
    return data || []
  },
}
