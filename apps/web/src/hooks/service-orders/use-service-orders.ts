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
} from '@/services/service-orders/service-orders.types'

export const serviceOrderKeys = {
  all: ['service-orders'] as const,
  company: (params?: ListServiceOrdersParams) =>
    ['service-orders', 'company', params] as const,
  detail: (clientId: string, id: string) =>
    ['service-orders', 'detail', clientId, id] as const,
  tasks: (clientId: string, id: string) =>
    ['service-orders', 'tasks', clientId, id] as const,
}

// ─────────────────────────────────────────
// Listagem company-wide (painel operacional)
// ─────────────────────────────────────────
export function useServiceOrders(params?: ListServiceOrdersParams) {
  return useQuery({
    queryKey: serviceOrderKeys.company(params),
    queryFn: () => serviceOrdersService.listCompany(params),
    staleTime: 30_000,
    refetchInterval: 60_000, // atualiza a cada 1 min
  })
}

// ─────────────────────────────────────────
// Detalhes de uma OS (com tarefas, comentários, histórico)
// ─────────────────────────────────────────
export function useServiceOrder(clientId: string, id: string) {
  return useQuery({
    queryKey: serviceOrderKeys.detail(clientId, id),
    queryFn: () => serviceOrdersService.getById(clientId, id),
    enabled: Boolean(clientId && id),
  })
}

// ─────────────────────────────────────────
// Tarefas de uma OS
// ─────────────────────────────────────────
export function useServiceOrderTasks(clientId: string, id: string) {
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
export function useUpdateServiceOrderStatus(clientId: string, id: string) {
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
export function useAssumeServiceOrder(clientId: string, id: string) {
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
export function useAddTechnician(clientId: string, id: string) {
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
export function useRemoveTechnician(clientId: string, id: string) {
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
export function useAddComment(clientId: string, id: string) {
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
export function useCreateTask(clientId: string, id: string) {
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
export function useUpdateTask(clientId: string, osId: string) {
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
export function useDeleteTask(clientId: string, osId: string) {
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
