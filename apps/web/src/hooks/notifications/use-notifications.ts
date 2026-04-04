import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsService } from '@/services/notifications/notifications.service'

export const notificationKeys = {
  all: ['notifications'] as const,
}

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => notificationsService.list(1, 20),
    staleTime: 60_000,
  })
}

export function useMarkNotificationAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsService.markAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllNotificationsAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsService.markAllAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
