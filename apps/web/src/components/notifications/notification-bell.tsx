'use client'

import { useEffect, useRef } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  notificationKeys,
} from '@/hooks/notifications/use-notifications'
import { useIsAuthenticated } from '@/store/auth.store'

export function NotificationBell() {
  const isAuthenticated = useIsAuthenticated()
  const queryClient = useQueryClient()
  const socketRef = useRef<Socket | null>(null)

  const { data: notifications = [] } = useNotifications()
  const markAsRead = useMarkNotificationAsRead()
  const markAllAsRead = useMarkAllNotificationsAsRead()

  const unreadCount = notifications.filter((n) => !n.readAt).length

  // WebSocket — conecta quando autenticado
  useEffect(() => {
    if (!isAuthenticated) return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000'

    const socket = io(`${wsUrl}/notifications`, {
      withCredentials: true, // envia o cookie access_token automaticamente
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('notification', () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    })

    socket.on('connect_error', (err) => {
      console.warn('[WS] Erro de conexão:', err.message)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, queryClient])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded-full transition-colors hover:bg-muted relative"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold text-foreground">
            Notificações
            {unreadCount > 0 && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({unreadCount} não lida{unreadCount > 1 ? 's' : ''})
              </span>
            )}
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>

        {/* Lista */}
        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                    !n.readAt ? 'bg-blue-50/60' : ''
                  }`}
                  onClick={() => {
                    if (!n.readAt) markAsRead.mutate(n.id)
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    {!n.readAt && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                    <div className={!n.readAt ? '' : 'pl-4'}>
                      <p className="text-xs font-semibold text-foreground leading-snug">
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
