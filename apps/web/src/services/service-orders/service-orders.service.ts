import { api } from '@/lib/api'
import type {
  ServiceOrder,
  ServiceOrderDetail,
  ServiceOrderTask,
  ServiceOrderComment,
  ListServiceOrdersParams,
  CreateServiceOrderDto,
  UpdateServiceOrderStatusDto,
  AssignTechnicianDto,
  CreateCommentDto,
  CreateTaskDto,
  UpdateTaskDto,
} from './service-orders.types'

// Resposta paginada como retornada pelo backend (via ResponseInterceptor)
export interface PaginatedOsResponse {
  success: boolean
  data: ServiceOrder[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  timestamp: string
}

// Listagem company-wide (painel operacional)
async function listCompany(
  params?: ListServiceOrdersParams,
): Promise<PaginatedOsResponse> {
  const { data } = await api.get('/service-orders', { params })
  return data
}

// Listagem por cliente
async function listByClient(
  clientId: string,
  params?: ListServiceOrdersParams,
): Promise<PaginatedOsResponse> {
  const { data } = await api.get(`/clients/${clientId}/service-orders`, { params })
  return data
}

async function getById(
  clientId: string,
  id: string,
): Promise<ServiceOrderDetail> {
  const { data } = await api.get(`/clients/${clientId}/service-orders/${id}`)
  return data
}

async function create(dto: CreateServiceOrderDto): Promise<ServiceOrder> {
  const { clientId, ...body } = dto
  const { data } = await api.post(`/clients/${clientId}/service-orders`, body)
  return data
}

async function updateStatus(
  clientId: string,
  id: string,
  dto: UpdateServiceOrderStatusDto,
): Promise<ServiceOrder> {
  const { data } = await api.patch(`/clients/${clientId}/service-orders/${id}/status`, dto)
  return data
}

async function assume(clientId: string, id: string): Promise<ServiceOrder> {
  const { data } = await api.post(`/clients/${clientId}/service-orders/${id}/assume`)
  return data
}

async function addTechnician(
  clientId: string,
  id: string,
  dto: AssignTechnicianDto,
) {
  const { data } = await api.post(`/clients/${clientId}/service-orders/${id}/technicians`, dto)
  return data
}

async function removeTechnician(
  clientId: string,
  id: string,
  technicianId: string,
) {
  const { data } = await api.delete(
    `/clients/${clientId}/service-orders/${id}/technicians/${technicianId}`,
  )
  return data
}

async function addComment(
  clientId: string,
  id: string,
  dto: CreateCommentDto,
): Promise<ServiceOrderComment> {
  const { data } = await api.post(`/clients/${clientId}/service-orders/${id}/comments`, dto)
  return data
}

async function deleteComment(
  clientId: string,
  osId: string,
  commentId: string,
) {
  const { data } = await api.delete(
    `/clients/${clientId}/service-orders/${osId}/comments/${commentId}`,
  )
  return data
}

async function getTasks(
  clientId: string,
  id: string,
): Promise<ServiceOrderTask[]> {
  const { data } = await api.get(`/clients/${clientId}/service-orders/${id}/tasks`)
  return data
}

async function createTask(
  clientId: string,
  id: string,
  dto: CreateTaskDto,
): Promise<ServiceOrderTask> {
  const { data } = await api.post(`/clients/${clientId}/service-orders/${id}/tasks`, dto)
  return data
}

async function updateTask(
  clientId: string,
  osId: string,
  taskId: string,
  dto: UpdateTaskDto,
): Promise<ServiceOrderTask> {
  const { data } = await api.patch(
    `/clients/${clientId}/service-orders/${osId}/tasks/${taskId}`,
    dto,
  )
  return data
}

async function deleteTask(
  clientId: string,
  osId: string,
  taskId: string,
) {
  const { data } = await api.delete(
    `/clients/${clientId}/service-orders/${osId}/tasks/${taskId}`,
  )
  return data
}

export const serviceOrdersService = {
  listCompany,
  listByClient,
  getById,
  create,
  updateStatus,
  assume,
  addTechnician,
  removeTechnician,
  addComment,
  deleteComment,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
}
