import { api } from '@/lib/api'

export interface AppNotification {
  id: string
  title: string
  body: string
  readAt: string | null
  createdAt: string
  serviceOrderId: string | null
  channel: string
  status: string
}

export const notificationsService = {
  async list(page = 1, limit = 20): Promise<AppNotification[]> {
    // The api interceptor unwraps response.data.data → array
    const res = await api.get('/notifications', { params: { page, limit } })
    return Array.isArray(res.data) ? res.data : []
  },

  async markAsRead(id: string) {
    await api.patch(`/notifications/${id}/read`)
  },

  async markAllAsRead() {
    await api.patch('/notifications/read-all')
  },
}
