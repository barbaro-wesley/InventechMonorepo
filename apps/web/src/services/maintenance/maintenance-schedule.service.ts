import { api } from '@/lib/api'

export type RecurrenceType =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL'
  | 'CUSTOM'

export interface MaintenanceSchedule {
  id: string
  companyId: string
  clientId: string | null
  title: string
  description: string | null
  maintenanceType: string
  recurrenceType: RecurrenceType
  customIntervalDays: number | null
  estimatedDurationMin: number | null
  startDate: string
  endDate: string | null
  nextRunAt: string
  lastRunAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  equipment: { id: string; name: string; brand: string | null; model: string | null }
  group: { id: string; name: string; color: string | null } | null
  client: { id: string; name: string } | null
  _count: { maintenances: number }
}

export interface CreateMaintenanceScheduleDto {
  clientId: string
  equipmentId: string
  title: string
  description?: string
  maintenanceType: string
  recurrenceType: RecurrenceType
  customIntervalDays?: number
  estimatedDurationMin?: number
  groupId?: string
  startDate: string
  endDate?: string
}

export interface ListSchedulesParams {
  search?: string
  equipmentId?: string
  maintenanceType?: string
  recurrenceType?: RecurrenceType
  isActive?: boolean
  page?: number
  limit?: number
}

export interface PaginatedSchedulesResponse {
  data: MaintenanceSchedule[]
  total: number
  page: number
  limit: number
}

// Company-wide listing (COMPANY_ADMIN/MANAGER see all clients, CLIENT_ADMIN scoped automatically)
async function listAll(params?: ListSchedulesParams): Promise<PaginatedSchedulesResponse> {
  const { data } = await api.get('/maintenance-schedules', { params })
  return data
}

// Client-scoped listing
async function listByClient(
  clientId: string,
  params?: ListSchedulesParams,
): Promise<PaginatedSchedulesResponse> {
  const { data } = await api.get(`/clients/${clientId}/maintenance-schedules`, { params })
  return data
}

async function getById(clientId: string, id: string): Promise<MaintenanceSchedule> {
  const { data } = await api.get(`/clients/${clientId}/maintenance-schedules/${id}`)
  return data.data ?? data
}

async function create(dto: CreateMaintenanceScheduleDto): Promise<MaintenanceSchedule> {
  const { clientId, ...body } = dto
  const { data } = await api.post(`/clients/${clientId}/maintenance-schedules`, body)
  return data.data ?? data
}

async function toggle(id: string, isActive: boolean): Promise<MaintenanceSchedule> {
  const { data } = await api.patch(`/maintenance-schedules/${id}/toggle`, { isActive })
  return data.data ?? data
}

async function trigger(clientId: string) {
  const { data } = await api.post(`/clients/${clientId}/maintenance-schedules/trigger`)
  return data.data ?? data
}

export const maintenanceScheduleService = {
  listAll,
  listByClient,
  getById,
  create,
  toggle,
  trigger,
}
