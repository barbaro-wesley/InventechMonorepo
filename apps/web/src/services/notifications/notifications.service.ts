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
    const res = await api.get('/notifications', { params: { page, limit } })
    // Resposta paginada: interceptor preserva o envelope { data: [...], pagination: {...} }
    if (res.data && Array.isArray(res.data.data)) return res.data.data
    // Resposta simples: interceptor já desembrulhou para o array
    if (Array.isArray(res.data)) return res.data
    return []
  },

  async markAsRead(id: string) {
    await api.patch(`/notifications/${id}/read`)
  },

  async markAllAsRead() {
    await api.patch('/notifications/read-all')
  },
}
