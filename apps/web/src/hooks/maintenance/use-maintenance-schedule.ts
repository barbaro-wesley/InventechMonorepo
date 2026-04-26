'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  maintenanceScheduleService,
  type CreateMaintenanceScheduleDto,
  type UpdateMaintenanceScheduleDto,
  type ListSchedulesParams,
} from '@/services/maintenance/maintenance-schedule.service'
import { maintenanceGroupsService } from '@/services/maintenance-groups/maintenance-groups.service'
import { getErrorMessage } from '@/lib/api'

export const scheduleKeys = {
  all: ['maintenance-schedules'] as const,
  list: (params?: ListSchedulesParams) =>
    ['maintenance-schedules', 'list', params] as const,
  upcoming: (daysAhead?: number) =>
    ['maintenance-schedules', 'upcoming', daysAhead ?? 30] as const,
}

export function useUpcomingPreventives(daysAhead = 30) {
  return useQuery({
    queryKey: scheduleKeys.upcoming(daysAhead),
    queryFn: () => maintenanceScheduleService.listUpcoming(daysAhead),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  })
}

export function useMaintenanceSchedules(params?: ListSchedulesParams) {
  return useQuery({
    queryKey: scheduleKeys.list(params),
    queryFn: () => maintenanceScheduleService.listAll(params),
    staleTime: 30_000,
  })
}

export function useCreateMaintenanceSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: CreateMaintenanceScheduleDto) =>
      maintenanceScheduleService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
      toast.success('Agendamento de preventiva criado com sucesso')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateMaintenanceSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      clientId,
      id,
      dto,
    }: {
      clientId: string
      id: string
      dto: UpdateMaintenanceScheduleDto
    }) => maintenanceScheduleService.update(clientId, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
      toast.success('Agendamento atualizado com sucesso')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useToggleSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      maintenanceScheduleService.toggle(id, isActive),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
      toast.success(isActive ? 'Agendamento ativado' : 'Agendamento desativado')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useTriggerSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (clientId: string) => maintenanceScheduleService.trigger(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
      toast.success('Geração de OS preventivas iniciada!')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeleteMaintenanceSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ clientId, id }: { clientId: string; id: string }) =>
      maintenanceScheduleService.remove(clientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
      toast.success('Agendamento removido com sucesso')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useMaintenanceGroups() {
  return useQuery({
    queryKey: ['maintenance-groups', 'list'],
    queryFn: () => maintenanceGroupsService.list({ isActive: true }),
    staleTime: 5 * 60_000,
  })
}
