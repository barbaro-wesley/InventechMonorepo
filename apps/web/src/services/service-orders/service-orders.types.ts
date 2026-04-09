export type ServiceOrderStatus =
  | 'OPEN'
  | 'AWAITING_PICKUP'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'COMPLETED_APPROVED'
  | 'COMPLETED_REJECTED'
  | 'CANCELLED'

export type ServiceOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type MaintenanceType =
  | 'PREVENTIVE'
  | 'CORRECTIVE'
  | 'INITIAL_ACCEPTANCE'
  | 'EXTERNAL_SERVICE'
  | 'TECHNOVIGILANCE'
  | 'TRAINING'
  | 'IMPROPER_USE'
  | 'DEACTIVATION'

export type TechnicianRole = 'LEAD' | 'ASSISTANT'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export interface ServiceOrderTechnician {
  id: string
  role: TechnicianRole
  assignedAt: string
  assumedAt: string | null
  technician: { id: string; name: string; email: string; phone: string | null }
}

export interface ServiceOrder {
  id: string
  companyId: string
  clientId: string
  number: number
  title: string
  description: string
  maintenanceType: MaintenanceType
  status: ServiceOrderStatus
  priority: ServiceOrderPriority
  resolution: string | null
  internalNotes: string | null
  estimatedHours: number | null
  actualHours: number | null
  scheduledFor: string | null
  startedAt: string | null
  completedAt: string | null
  approvedAt: string | null
  isAvailable: boolean
  alertAfterHours: number
  alertSentAt: string | null
  createdAt: string
  updatedAt: string
  client: { id: string; name: string; logoUrl: string | null }
  equipment: { id: string; name: string; brand: string | null; model: string | null }
  requester: { id: string; name: string; email: string } | null
  group: { id: string; name: string; color: string | null } | null
  technicians: ServiceOrderTechnician[]
  _count: { comments: number; tasks: number; attachments: number }
}

import type { Attachment } from '../storage/storage.service'

export interface ServiceOrderComment {
  id: string
  content: string
  isInternal: boolean
  createdAt: string
  updatedAt: string
  author: { id: string; name: string; avatarUrl?: string | null }
  attachments?: Attachment[]
}

export interface ServiceOrderTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  position: number
  dueDate: string | null
  completedAt: string | null
  assignedTo: { id: string; name: string } | null
  createdAt: string
}

export interface ServiceOrderStatusHistory {
  id: string
  fromStatus: ServiceOrderStatus | null
  toStatus: ServiceOrderStatus
  reason: string | null
  createdAt: string
  changedBy: { id: string; name: string } | null
}

export interface ServiceOrderDetail extends ServiceOrder {
  comments: ServiceOrderComment[]
  tasks: ServiceOrderTask[]
  statusHistory: ServiceOrderStatusHistory[]
  attachments: Attachment[]
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ListServiceOrdersParams {
  search?: string
  status?: ServiceOrderStatus
  priority?: ServiceOrderPriority
  groupId?: string
  equipmentId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface CreateServiceOrderDto {
  clientId: string
  equipmentId: string
  title: string
  description: string
  maintenanceType: MaintenanceType
  priority?: ServiceOrderPriority
  groupId?: string
  technicianId?: string
  scheduledFor?: string
  alertAfterHours?: number
}

export interface UpdateServiceOrderStatusDto {
  status: ServiceOrderStatus
  resolution?: string
  reason?: string
  files?: File[]
}

export interface AssignTechnicianDto {
  technicianId: string
  role?: TechnicianRole
}

export interface CreateCommentDto {
  content: string
  isInternal?: boolean
  files?: File[]
}

export interface CreateTaskDto {
  title: string
  description?: string
  dueDate?: string
  assignedToId?: string
}

export interface UpdateTaskDto {
  title?: string
  description?: string
  status?: TaskStatus
  dueDate?: string
  assignedToId?: string
}
