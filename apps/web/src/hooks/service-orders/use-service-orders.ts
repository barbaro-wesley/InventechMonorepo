'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { serviceOrdersService, type PaginatedOsResponse } from '@/services/service-orders/service-orders.service'
import { getErrorMessage } from '@/lib/api'
import type {
  ListServiceOrdersParams,
  UpdateServiceOrderStatusDto,
  AssignTechnicianDto,
  CreateCommentDto,
  CreateTaskDto,
  UpdateTaskDto,
  CreateServiceOrderDto,
  CreateCostItemDto,
  UpdateCostItemDto,
} from '@/services/service-orders/service-orders.types'

export const serviceOrderKeys = {
  all: ['service-orders'] as const,
  company: (params?: ListServiceOrdersParams) =>
    ['service-orders', 'company', params] as const,
  mine: (params?: ListServiceOrdersParams) =>
    ['service-orders', 'mine', params] as const,
  myStats: () => ['service-orders', 'my-stats'] as const,
  detail: (clientId: string | null, id: string) =>
    ['service-orders', 'detail', clientId ?? '', id] as const,
  tasks: (clientId: string | null, id: string) =>
    ['service-orders', 'tasks', clientId ?? '', id] as const,
  costs: (clientId: string | null, id: string) =>
    ['service-orders', 'costs', clientId ?? '', id] as const,
}

// ─────────────────────────────────────────
// Listagem company-wide (painel operacional)
// ─────────────────────────────────────────
export function useServiceOrders(params?: ListServiceOrdersParams | null) {
  return useQuery({
    queryKey: serviceOrderKeys.company(params ?? undefined),
    queryFn: () => serviceOrdersService.listCompany(params ?? undefined),
    enabled: params !== null,
    placeholderData: (prev) => prev,   // mantém dados anteriores visíveis ao trocar de página/filtro
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// ─────────────────────────────────────────
// Minhas OS (solicitante)
// ─────────────────────────────────────────
export function useMyServiceOrders(params?: ListServiceOrdersParams) {
  return useQuery({
    queryKey: serviceOrderKeys.mine(params),
    queryFn: () => serviceOrdersService.listMine(params),
    staleTime: 30_000,
  })
}

export function useMyOsStats() {
  return useQuery({
    queryKey: serviceOrderKeys.myStats(),
    queryFn: () => serviceOrdersService.getMyStats(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

// ─────────────────────────────────────────
// Atualizar OS (título, descrição, prioridade)
// ─────────────────────────────────────────
export function useUpdateServiceOrder(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: { title?: string; description?: string; priority?: string }) =>
      serviceOrdersService.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.all })
      toast.success('OS atualizada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Detalhes de uma OS (com tarefas, comentários, histórico)
// ─────────────────────────────────────────
export function useServiceOrder(clientId: string | null, id: string) {
  return useQuery({
    queryKey: serviceOrderKeys.detail(clientId ?? '', id),
    queryFn: () =>
      clientId
        ? serviceOrdersService.getById(clientId, id)
        : serviceOrdersService.getByIdCompany(id),
    enabled: Boolean(id),
  })
}

// ─────────────────────────────────────────
// Tarefas de uma OS
// ─────────────────────────────────────────
export function useServiceOrderTasks(clientId: string | null, id: string) {
  return useQuery({
    queryKey: serviceOrderKeys.tasks(clientId, id),
    queryFn: () => serviceOrdersService.getTasks(clientId, id),
    enabled: Boolean(clientId && id),
  })
}

// ─────────────────────────────────────────
// Criar OS
// ─────────────────────────────────────────
export function useCreateServiceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateServiceOrderDto) => serviceOrdersService.create(dto),
    onSuccess: (os) => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.all })
      toast.success(`OS #${os.number} criada com sucesso`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Atualizar status
// ─────────────────────────────────────────
export function useUpdateServiceOrderStatus(clientId: string | null, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateServiceOrderStatusDto) =>
      serviceOrdersService.updateStatus(clientId, id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.all })
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, id) })
      toast.success('Status atualizado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Assumir OS do painel
// ─────────────────────────────────────────
export function useAssumeServiceOrder(clientId: string | null, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => serviceOrdersService.assume(clientId, id),
    onSuccess: (os) => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.all })
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, id) })
      toast.success(`OS #${os.number} assumida — em andamento`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Adicionar técnico
// ─────────────────────────────────────────
export function useAddTechnician(clientId: string | null, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: AssignTechnicianDto) =>
      serviceOrdersService.addTechnician(clientId, id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, id) })
      toast.success('Técnico adicionado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Remover técnico
// ─────────────────────────────────────────
export function useRemoveTechnician(clientId: string | null, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (technicianId: string) =>
      serviceOrdersService.removeTechnician(clientId, id, technicianId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, id) })
      toast.success('Técnico removido')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Adicionar comentário
// ─────────────────────────────────────────
export function useAddComment(clientId: string | null, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateCommentDto) =>
      serviceOrdersService.addComment(clientId, id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, id) })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Criar tarefa
// ─────────────────────────────────────────
export function useCreateTask(clientId: string | null, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateTaskDto) =>
      serviceOrdersService.createTask(clientId, id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, id) })
      qc.invalidateQueries({ queryKey: serviceOrderKeys.tasks(clientId, id) })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Atualizar tarefa
// ─────────────────────────────────────────
export function useUpdateTask(clientId: string | null, osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, dto }: { taskId: string; dto: UpdateTaskDto }) =>
      serviceOrdersService.updateTask(clientId, osId, taskId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, osId) })
      qc.invalidateQueries({ queryKey: serviceOrderKeys.tasks(clientId, osId) })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Deletar tarefa
// ─────────────────────────────────────────
export function useDeleteTask(clientId: string | null, osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      serviceOrdersService.deleteTask(clientId, osId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, osId) })
      qc.invalidateQueries({ queryKey: serviceOrderKeys.tasks(clientId, osId) })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─────────────────────────────────────────
// Itens de custo de uma OS
// ─────────────────────────────────────────
export function useCostItems(clientId: string | null, osId: string) {
  return useQuery({
    queryKey: serviceOrderKeys.costs(clientId, osId),
    queryFn: () => serviceOrdersService.getCostItems(clientId, osId),
    enabled: Boolean(osId),
  })
}

export function useCreateCostItem(clientId: string | null, osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateCostItemDto) =>
      serviceOrdersService.createCostItem(clientId, osId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.costs(clientId, osId) })
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, osId) })
      toast.success('Item de custo adicionado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useUpdateCostItem(clientId: string | null, osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ costId, dto }: { costId: string; dto: UpdateCostItemDto }) =>
      serviceOrdersService.updateCostItem(clientId, osId, costId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.costs(clientId, osId) })
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, osId) })
      toast.success('Item atualizado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useDeleteCostItem(clientId: string | null, osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (costId: string) =>
      serviceOrdersService.deleteCostItem(clientId, osId, costId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.costs(clientId, osId) })
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(clientId, osId) })
      toast.success('Item removido')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
