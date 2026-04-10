'use client'

import { useState, useMemo } from 'react'
import { useCurrentUser } from '@/store/auth.store'
import { useServiceOrders } from '@/hooks/service-orders/use-service-orders'
import { QuickStatsBar } from './_components/quick-stats-bar'
import { CommandBar, type ViewMode } from './_components/command-bar'
import { OsBoard } from './_components/os-board'
import { OsList } from './_components/os-list'
import { OsDetailDrawer } from './_components/os-detail-drawer'
import type { ServiceOrder, ServiceOrderStatus, ServiceOrderPriority } from '@/services/service-orders/service-orders.types'

export default function OperacionalPage() {
  const user = useCurrentUser()

  // Filtros locais (client-side filtering para performance no board)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ServiceOrderStatus | ''>('')
  const [priority, setPriority] = useState<ServiceOrderPriority | ''>('')
  const [view, setView] = useState<ViewMode>('board')
  const [myOrders, setMyOrders] = useState(false)
  const [showClosed, setShowClosed] = useState(false)

  // Drawer de detalhes
  const [selectedOs, setSelectedOs] = useState<{ id: string; clientId: string } | null>(null)

  // Busca server-side (apenas para filtros de status e prioridade quando em lista)
  const serverParams = view === 'list'
    ? { status: status || undefined, priority: priority || undefined, search: search || undefined, limit: 100 }
    : { limit: 100 } // board filtra client-side

  const { data: response, isLoading } = useServiceOrders(serverParams)
  const allOrders: ServiceOrder[] = response?.data ?? []

  // Filtragem client-side para o board (mantém todas as colunas visíveis)
  const filteredOrders = useMemo(() => {
    return allOrders.filter((os) => {
      if (status && os.status !== status) return false
      if (priority && os.priority !== priority) return false
      if (myOrders && user) {
        const isMine = os.technicians.some((t) => t.technician.id === user.id)
        if (!isMine) return false
      }
      if (search) {
        const q = search.toLowerCase()
        return (
          os.title.toLowerCase().includes(q) ||
          (os.client?.name ?? '').toLowerCase().includes(q) ||
          (os.equipment?.name ?? '').toLowerCase().includes(q) ||
          String(os.number).includes(q)
        )
      }
      return true
    })
  }, [allOrders, status, priority, search, myOrders, user])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Barra de stats em tempo real */}
      <QuickStatsBar orders={allOrders} isLoading={isLoading} />

      {/* Barra de filtros + ações */}
      <CommandBar
        view={view}
        onViewChange={setView}
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        priority={priority}
        onPriorityChange={setPriority}
        myOrders={myOrders}
        onMyOrdersChange={setMyOrders}
        showClosed={showClosed}
        onShowClosedChange={setShowClosed}
      />

      {/* Conteúdo principal */}
      {isLoading ? (
        <BoardSkeleton view={view} />
      ) : view === 'board' ? (
        <OsBoard
          orders={filteredOrders}
          showClosed={showClosed}
          onCardClick={(os) => setSelectedOs({ id: os.id, clientId: os.client?.id ?? os.clientId ?? '' })}
        />
      ) : (
        <div className="flex-1 overflow-hidden bg-white mx-4 my-4 rounded-xl border border-[#e0e5eb] shadow-sm">
          <OsList
            orders={filteredOrders}
            onRowClick={(os) => setSelectedOs({ id: os.id, clientId: os.client?.id ?? os.clientId ?? '' })}
          />
        </div>
      )}

      {/* Detail drawer */}
      <OsDetailDrawer
        osId={selectedOs?.id ?? null}
        clientId={selectedOs?.clientId ?? null}
        open={!!selectedOs}
        onClose={() => setSelectedOs(null)}
      />

    </div>
  )
}

function BoardSkeleton({ view }: { view: ViewMode }) {
  if (view === 'list') {
    return (
      <div className="flex-1 bg-white mx-4 my-4 rounded-xl border border-[#e0e5eb] p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-[#f3f4f7] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-4 px-4 py-4 h-full overflow-x-auto">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div key={colIdx} className="w-72 shrink-0 space-y-3">
          <div className="h-10 rounded-xl bg-white border border-[#e0e5eb] animate-pulse" />
          {Array.from({ length: 3 - (colIdx % 2) }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-white border border-[#e0e5eb] animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
