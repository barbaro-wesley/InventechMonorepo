'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  maintenanceScheduleService,
  type CreateMaintenanceScheduleDto,
  type ListSchedulesParams,
} from '@/services/maintenance/maintenance-schedule.service'
import { getErrorMessage } from '@/lib/api'

export const scheduleKeys = {
  all: ['maintenance-schedules'] as const,
  list: (params?: ListSchedulesParams) =>
    ['maintenance-schedules', 'list', params] as const,
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
