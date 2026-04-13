import { api } from '@/lib/api'
import type {
  ServiceOrder,
  ServiceOrderDetail,
  ServiceOrderTask,
  ServiceOrderComment,
  ListServiceOrdersParams,
  MyOsStats,
  CreateServiceOrderDto,
  UpdateServiceOrderStatusDto,
  AssignTechnicianDto,
  CreateCommentDto,
  CreateTaskDto,
  UpdateTaskDto,
  CostItemsResponse,
  ServiceOrderCostItem,
  CreateCostItemDto,
  UpdateCostItemDto,
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

async function getByIdCompany(id: string): Promise<ServiceOrderDetail> {
  const { data } = await api.get(`/service-orders/${id}`)
  return data
}

async function listMine(
  params?: ListServiceOrdersParams,
): Promise<PaginatedOsResponse> {
  const { data } = await api.get('/service-orders/mine', { params })
  return data
}

async function getMyStats(): Promise<MyOsStats> {
  const { data } = await api.get('/service-orders/my-stats')
  return data
}

async function update(
  id: string,
  dto: { title?: string; description?: string; priority?: string },
): Promise<ServiceOrder> {
  const { data } = await api.patch(`/service-orders/${id}`, dto)
  return data
}

async function create(dto: CreateServiceOrderDto): Promise<ServiceOrder> {
  const { clientId, ...body } = dto
  const { data } = await api.post(`/clients/${clientId}/service-orders`, body)
  return data
}

function osBase(clientId: string | null, id: string) {
  return clientId
    ? `/clients/${clientId}/service-orders/${id}`
    : `/service-orders/${id}`
}

async function updateStatus(
  clientId: string | null,
  id: string,
  dto: UpdateServiceOrderStatusDto,
): Promise<ServiceOrder> {
  if (!dto.files || dto.files.length === 0) {
    const { files: _files, ...body } = dto
    const { data } = await api.patch(`${osBase(clientId, id)}/status`, body)
    return data
  }

  const formData = new FormData()
  formData.append('status', dto.status)
  if (dto.resolution) formData.append('resolution', dto.resolution)
  if (dto.reason) formData.append('reason', dto.reason)
  dto.files.forEach((file) => formData.append('files', file))

  const { data } = await api.patch(`${osBase(clientId, id)}/status`, formData)
  return data
}

async function assume(clientId: string | null, id: string): Promise<ServiceOrder> {
  const { data } = await api.post(`${osBase(clientId, id)}/assume`)
  return data
}

async function addTechnician(
  clientId: string | null,
  id: string,
  dto: AssignTechnicianDto,
) {
  const { data } = await api.post(`${osBase(clientId, id)}/technicians`, dto)
  return data
}

async function removeTechnician(
  clientId: string | null,
  id: string,
  technicianId: string,
) {
  const { data } = await api.delete(`${osBase(clientId, id)}/technicians/${technicianId}`)
  return data
}

async function addComment(
  clientId: string | null,
  id: string,
  dto: CreateCommentDto,
): Promise<ServiceOrderComment> {
  if (!dto.files || dto.files.length === 0) {
    const { data } = await api.post(`${osBase(clientId, id)}/comments`, {
      content: dto.content,
      isInternal: dto.isInternal,
    })
    return data
  }

  const formData = new FormData()
  formData.append('content', dto.content)
  if (dto.isInternal !== undefined) {
    formData.append('isInternal', String(dto.isInternal))
  }
  dto.files.forEach((file) => {
    formData.append('files', file)
  })

  const { data } = await api.post(`${osBase(clientId, id)}/comments`, formData)
  return data
}

async function deleteComment(
  clientId: string | null,
  osId: string,
  commentId: string,
) {
  const { data } = await api.delete(
    `/clients/${clientId}/service-orders/${osId}/comments/${commentId}`,
  )
  return data
}

async function getTasks(
  clientId: string | null,
  id: string,
): Promise<ServiceOrderTask[]> {
  const { data } = await api.get(`${osBase(clientId, id)}/tasks`)
  return data
}

async function createTask(
  clientId: string | null,
  id: string,
  dto: CreateTaskDto,
): Promise<ServiceOrderTask> {
  const { data } = await api.post(`${osBase(clientId, id)}/tasks`, dto)
  return data
}

async function updateTask(
  clientId: string | null,
  osId: string,
  taskId: string,
  dto: UpdateTaskDto,
): Promise<ServiceOrderTask> {
  const { data } = await api.patch(`${osBase(clientId, osId)}/tasks/${taskId}`, dto)
  return data
}

async function deleteTask(
  clientId: string | null,
  osId: string,
  taskId: string,
) {
  const { data } = await api.delete(`${osBase(clientId, osId)}/tasks/${taskId}`)
  return data
}

// ── Custos ──────────────────────────────────────────────────────────────────

async function getCostItems(
  clientId: string | null,
  osId: string,
): Promise<CostItemsResponse> {
  const { data } = await api.get(`${osBase(clientId, osId)}/costs`)
  return data
}

async function createCostItem(
  clientId: string | null,
  osId: string,
  dto: CreateCostItemDto,
): Promise<ServiceOrderCostItem> {
  const { data } = await api.post(`${osBase(clientId, osId)}/costs`, dto)
  return data
}

async function updateCostItem(
  clientId: string | null,
  osId: string,
  costId: string,
  dto: UpdateCostItemDto,
): Promise<ServiceOrderCostItem> {
  const { data } = await api.patch(`${osBase(clientId, osId)}/costs/${costId}`, dto)
  return data
}

async function deleteCostItem(
  clientId: string | null,
  osId: string,
  costId: string,
) {
  const { data } = await api.delete(`${osBase(clientId, osId)}/costs/${costId}`)
  return data
}

export const serviceOrdersService = {
  listCompany,
  listByClient,
  listMine,
  getMyStats,
  getById,
  getByIdCompany,
  create,
  update,
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
  getCostItems,
  createCostItem,
  updateCostItem,
  deleteCostItem,
}
