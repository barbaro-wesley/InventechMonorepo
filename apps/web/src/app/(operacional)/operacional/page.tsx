'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useCurrentUser } from '@/store/auth.store'
import { useServiceOrders } from '@/hooks/service-orders/use-service-orders'
import { QuickStatsBar } from './_components/quick-stats-bar'
import { CommandBar, type ViewMode } from './_components/command-bar'
import { OsBoard } from './_components/os-board'
import { OsList } from './_components/os-list'
import { OsDetailDrawer } from './_components/os-detail-drawer'
import type { ServiceOrder, ServiceOrderStatus, ServiceOrderPriority } from '@/services/service-orders/service-orders.types'

// ── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Page ─────────────────────────────────────────────────────────────────────

const LIST_PAGE_SIZE = 25

export default function OperacionalPage() {
  const user = useCurrentUser()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ServiceOrderStatus | ''>('')
  const [priority, setPriority] = useState<ServiceOrderPriority | ''>('')
  const [view, setView] = useState<ViewMode>('board')
  const [myOrders, setMyOrders] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [page, setPage] = useState(1)

  // Reseta página quando filtros mudam
  const prevFilters = useRef({ search, status, priority })
  useEffect(() => {
    const p = prevFilters.current
    if (p.search !== search || p.status !== status || p.priority !== priority) {
      setPage(1)
      prevFilters.current = { search, status, priority }
    }
  }, [search, status, priority])

  // Debounce da busca (300ms) — evita request a cada tecla
  const debouncedSearch = useDebounce(search, 300)
  const isSearching = search !== debouncedSearch

  // Drawer de detalhes
  const [selectedOs, setSelectedOs] = useState<{ id: string; clientId: string } | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  // Board: server-side search + filtros, limit máximo permitido pela API
  const boardParams = {
    search: debouncedSearch || undefined,
    status: status || undefined,
    priority: priority || undefined,
    limit: 100,
    page: 1,
  }

  // Lista: paginação real com 25 por página
  const listParams = {
    search: debouncedSearch || undefined,
    status: status || undefined,
    priority: priority || undefined,
    limit: LIST_PAGE_SIZE,
    page,
  }

  const { data: boardResponse, isLoading: boardLoading } = useServiceOrders(
    view === 'board' ? boardParams : null
  )
  const { data: listResponse, isLoading: listLoading } = useServiceOrders(
    view === 'list' ? listParams : null
  )

  const boardOrders: ServiceOrder[] = boardResponse?.data ?? []
  const listOrders: ServiceOrder[] = listResponse?.data ?? []
  const listTotal = listResponse?.pagination?.total ?? 0
  const listTotalPages = listResponse?.pagination?.totalPages ?? 1
  const isLoading = view === 'board' ? boardLoading : listLoading

  // Filtragem client-side só para board (myOrders e showClosed não vão para API)
  const filteredBoard = useMemo(() => {
    return boardOrders.filter((os) => {
      if (myOrders && user) {
        if (!os.technicians.some((t) => t.technician.id === user.id)) return false
      }
      return true
    })
  }, [boardOrders, myOrders, user])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <QuickStatsBar orders={boardOrders} isLoading={boardLoading} />

      <CommandBar
        view={view}
        onViewChange={(v) => { setView(v); setPage(1) }}
        search={search}
        onSearchChange={setSearch}
        isSearching={isSearching}
        status={status}
        onStatusChange={setStatus}
        priority={priority}
        onPriorityChange={setPriority}
        myOrders={myOrders}
        onMyOrdersChange={setMyOrders}
        showClosed={showClosed}
        onShowClosedChange={setShowClosed}
      />

      {isLoading ? (
        <BoardSkeleton view={view} />
      ) : view === 'board' ? (
        <OsBoard
          orders={filteredBoard}
          showClosed={showClosed}
          onCardClick={(os) => setSelectedOs({ id: os.id, clientId: os.client?.id ?? os.clientId ?? '' })}
        />
      ) : (
        <div className="flex-1 overflow-hidden bg-white mx-4 my-4 rounded-xl border border-[#e0e5eb] shadow-sm flex flex-col">
          <OsList
            orders={listOrders}
            onRowClick={(os) => setSelectedOs({ id: os.id, clientId: os.client?.id ?? os.clientId ?? '' })}
          />
          {/* Paginação */}
          {listTotalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#e0e5eb] bg-white shrink-0">
              <span className="text-xs text-[#6c7c93]">
                {listTotal} OS encontradas · página {page} de {listTotalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="h-7 px-2 rounded text-xs text-[#6c7c93] hover:bg-[#f3f4f7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  «
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-2.5 rounded text-xs text-[#6c7c93] hover:bg-[#f3f4f7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ Anterior
                </button>

                {/* Páginas numeradas */}
                {Array.from({ length: Math.min(5, listTotalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, listTotalPages - 4))
                  const p = start + i
                  if (p > listTotalPages) return null
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-7 w-7 rounded text-xs font-medium transition-colors ${
                        p === page
                          ? 'bg-[#0d4da5] text-white'
                          : 'text-[#6c7c93] hover:bg-[#f3f4f7]'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}

                <button
                  onClick={() => setPage((p) => Math.min(listTotalPages, p + 1))}
                  disabled={page >= listTotalPages}
                  className="h-7 px-2.5 rounded text-xs text-[#6c7c93] hover:bg-[#f3f4f7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima ›
                </button>
                <button
                  onClick={() => setPage(listTotalPages)}
                  disabled={page >= listTotalPages}
                  className="h-7 px-2 rounded text-xs text-[#6c7c93] hover:bg-[#f3f4f7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
