'use client'

import { useState, useMemo } from 'react'
import { useCurrentUser } from '@/store/auth.store'
import { useServiceOrders } from '@/hooks/service-orders/use-service-orders'
import { OsBoard } from '../operacional/_components/os-board'
import { OsDetailDrawer } from '../operacional/_components/os-detail-drawer'
import { TecnicoStatsBar } from './_components/tecnico-stats-bar'
import { TecnicoCommandBar } from './_components/tecnico-command-bar'
import { KANBAN_COLUMNS } from '../operacional/_components/os-utils'
import type { ServiceOrder, ServiceOrderPriority } from '@/services/service-orders/service-orders.types'

// Apenas as 4 colunas de trabalho do técnico (sem Encerradas)
const TECNICO_COLUMNS = KANBAN_COLUMNS.filter((c) =>
  ['AWAITING_PICKUP', 'OPEN', 'IN_PROGRESS', 'COMPLETED'].includes(c.status),
)

export default function TecnicoPage() {
  const user = useCurrentUser()
  const isTechnician = user?.role === 'TECHNICIAN'

  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<ServiceOrderPriority | ''>('')
  const [selectedOs, setSelectedOs] = useState<{ id: string; clientId: string } | null>(null)

  const { data: response, isLoading, isFetching, refetch } = useServiceOrders({ limit: 100 })
  const allOrders: ServiceOrder[] = response?.data ?? []

  // Para TECHNICIAN, o backend já filtra as OS deles automaticamente.
  // Para outros roles (admin/gerente no painel técnico), filtramos client-side.
  const myOrders = useMemo(() => {
    if (isTechnician || !user) return allOrders
    return allOrders.filter((os) =>
      os.technicians.some((t) => t.technician.id === user.id),
    )
  }, [allOrders, isTechnician, user])

  const filteredOrders = useMemo(() => {
    return myOrders.filter((os) => {
      // Só exibe OS ativas no painel do técnico
      if (['COMPLETED_APPROVED', 'COMPLETED_REJECTED', 'CANCELLED'].includes(os.status)) return false
      if (priority && os.priority !== priority) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          os.title.toLowerCase().includes(q) ||
          os.client.name.toLowerCase().includes(q) ||
          os.equipment.name.toLowerCase().includes(q) ||
          String(os.number).includes(q)
        )
      }
      return true
    })
  }, [myOrders, priority, search])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats */}
      <TecnicoStatsBar orders={filteredOrders} isLoading={isLoading} />

      {/* Barra de filtros */}
      <TecnicoCommandBar
        search={search}
        onSearchChange={setSearch}
        priority={priority}
        onPriorityChange={setPriority}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {/* Board */}
      {isLoading ? (
        <TecnicoBoardSkeleton />
      ) : filteredOrders.length === 0 && !search && !priority ? (
        <EmptyState isTechnician={isTechnician} />
      ) : (
        <OsBoard
          orders={filteredOrders}
          onCardClick={(os) => setSelectedOs({ id: os.id, clientId: os.clientId })}
          showClosed={false}
          columns={TECNICO_COLUMNS}
        />
      )}

      {/* Drawer de detalhes */}
      <OsDetailDrawer
        osId={selectedOs?.id ?? null}
        clientId={selectedOs?.clientId ?? null}
        open={!!selectedOs}
        onClose={() => setSelectedOs(null)}
      />
    </div>
  )
}

function EmptyState({ isTechnician }: { isTechnician: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#6c7c93]">
      <div className="h-16 w-16 rounded-2xl bg-[#f3f4f7] flex items-center justify-center">
        <span className="text-3xl">✓</span>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[#1d2530]">Nenhuma OS pendente</p>
        <p className="text-xs mt-1">
          {isTechnician
            ? 'Você não tem ordens de serviço abertas no momento.'
            : 'Nenhuma OS atribuída ao seu usuário.'}
        </p>
      </div>
    </div>
  )
}

function TecnicoBoardSkeleton() {
  return (
    <div className="flex gap-4 px-4 py-4 h-full overflow-x-auto">
      {Array.from({ length: 4 }).map((_, colIdx) => (
        <div key={colIdx} className="w-72 shrink-0 space-y-3">
          <div className="h-10 rounded-xl bg-white border border-[#e0e5eb] animate-pulse" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-white border border-[#e0e5eb] animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
