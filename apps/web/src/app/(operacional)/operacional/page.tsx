'use client'

import { useState, useMemo, useEffect } from 'react'
import { useCurrentUser } from '@/store/auth.store'
import { useServiceOrders } from '@/hooks/service-orders/use-service-orders'
import { useClients } from '@/hooks/clients/use-clients'
import { useMaintenanceGroups } from '@/hooks/maintenance-groups/use-maintenance-groups'
import { usePersistedFilters } from '@/hooks/use-persisted-filters'
import { QuickStatsBar } from './_components/quick-stats-bar'
import { CommandBar, type ViewMode } from './_components/command-bar'
import { OsBoard } from './_components/os-board'
import { OsList } from './_components/os-list'
import { OsDetailDrawer } from './_components/os-detail-drawer'
import type { ServiceOrder, ServiceOrderStatus, ServiceOrderPriority } from '@/services/service-orders/service-orders.types'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const LIST_PAGE_SIZE = 25
const BOARD_PAGE_SIZE = 100

export default function OperacionalPage() {
  const user = useCurrentUser()

  const { filters, set, hydrated } = usePersistedFilters(user?.id)

  const [page, setPage] = useState(1)
  const [boardPage, setBoardPage] = useState(1)
  const [allBoardOrders, setAllBoardOrders] = useState<ServiceOrder[]>([])
  const [selectedOs, setSelectedOs] = useState<{ id: string; clientId: string } | null>(null)

  // Debounce para busca server-side em ambas as views
  const debouncedSearch = useDebounce(filters.search, 350)
  const isTyping = filters.search !== debouncedSearch

  // Reseta paginação quando filtros mudam
  useEffect(() => { setPage(1) }, [debouncedSearch, filters.status, filters.priority, filters.clientId, filters.groupId])
  useEffect(() => { setBoardPage(1) }, [debouncedSearch, filters.status, filters.priority, filters.clientId, filters.groupId])

  // Dados para os dropdowns
  const { data: clientsData } = useClients({ limit: 100 })
  const { data: groupsData } = useMaintenanceGroups({ isActive: true })
  const clients = clientsData?.data ?? []
  const groups = groupsData ?? []

  // Params base dos filtros (compartilhado entre board e list)
  const filterParams = hydrated ? {
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    clientId: filters.clientId || undefined,
    groupId: filters.groupId || undefined,
  } : {}

  // ── Board ────────────────────────────────────────────────────────────────────
  const { data: boardResponse, isLoading: boardLoading, isFetching: boardFetching } = useServiceOrders(
    filters.view === 'board'
      ? { ...filterParams, limit: BOARD_PAGE_SIZE, page: boardPage }
      : null
  )

  // Acumula ordens do board ao paginar; reseta quando chega nova página 1
  useEffect(() => {
    if (!boardResponse?.data) return
    const responsePage = boardResponse.pagination?.page ?? 1
    if (responsePage === 1) {
      setAllBoardOrders(boardResponse.data)
    } else {
      setAllBoardOrders(prev => {
        const existingIds = new Set(prev.map(o => o.id))
        return [...prev, ...boardResponse.data.filter(o => !existingIds.has(o.id))]
      })
    }
  }, [boardResponse])

  const boardTotal = boardResponse?.pagination?.total ?? 0
  const boardHasMore = !isTyping && !boardFetching && allBoardOrders.length < boardTotal

  // ── Lista ─────────────────────────────────────────────────────────────────────
  const { data: listResponse, isLoading: listFirstLoad, isFetching: listFetching } = useServiceOrders(
    filters.view === 'list'
      ? { ...filterParams, limit: LIST_PAGE_SIZE, page }
      : null
  )

  const listOrders: ServiceOrder[] = listResponse?.data ?? []
  const listTotal = listResponse?.pagination?.total ?? 0
  const listTotalPages = listResponse?.pagination?.totalPages ?? 1

  // Filtro client-side no board — apenas "Minhas OS" (busca é server-side)
  const filteredBoard = useMemo(() => {
    if (!filters.myOrders || !user) return allBoardOrders
    return allBoardOrders.filter((os) =>
      os.technicians.some((t) => t.technician.id === user.id)
    )
  }, [allBoardOrders, filters.myOrders, user])

  const handleCardClick = (os: ServiceOrder) =>
    setSelectedOs({ id: os.id, clientId: os.client?.id ?? os.clientId ?? '' })

  const handleViewChange = (v: ViewMode) => {
    set('view', v)
    setPage(1)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <QuickStatsBar orders={allBoardOrders} isLoading={boardLoading} />

      <CommandBar
        view={filters.view}
        onViewChange={handleViewChange}
        search={filters.search}
        onSearchChange={(v) => set('search', v)}
        isTyping={isTyping}
        status={filters.status}
        onStatusChange={(v) => { set('status', v); setPage(1) }}
        priority={filters.priority}
        onPriorityChange={(v) => { set('priority', v); setPage(1) }}
        clientId={filters.clientId}
        onClientIdChange={(v) => { set('clientId', v); setPage(1) }}
        groupId={filters.groupId}
        onGroupIdChange={(v) => { set('groupId', v); setPage(1) }}
        clients={clients}
        groups={groups}
        myOrders={filters.myOrders}
        onMyOrdersChange={(v) => set('myOrders', v)}
        showClosed={filters.showClosed}
        onShowClosedChange={(v) => set('showClosed', v)}
      />

      {/* Board */}
      {filters.view === 'board' && (
        boardLoading
          ? <BoardSkeleton />
          : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Barra de loading sutil ao refetching */}
              {boardFetching && !boardLoading && (
                <div className="shrink-0 h-0.5 w-full bg-[#e0e5eb] dark:bg-zinc-800 overflow-hidden">
                  <div className="h-full w-1/2 bg-[#0d4da5] dark:bg-blue-500 rounded-full animate-pulse" />
                </div>
              )}
              <OsBoard orders={filteredBoard} showClosed={filters.showClosed} onCardClick={handleCardClick} />

              {/* Footer do board: total + carregar mais */}
              {(boardHasMore || boardFetching) ? (
                <div className="shrink-0 flex items-center justify-center gap-3 py-2 border-t border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950">
                  <span className="text-xs text-[#6c7c93] dark:text-zinc-400">
                    Exibindo {allBoardOrders.length} de {boardTotal} OS
                  </span>
                  <button
                    onClick={() => setBoardPage(p => p + 1)}
                    disabled={boardFetching}
                    className="h-7 px-4 rounded text-xs font-medium text-[#0d4da5] dark:text-blue-400 border border-[#0d4da5] dark:border-blue-500 hover:bg-[#f0f4ff] dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {boardFetching ? 'Carregando...' : 'Carregar mais'}
                  </button>
                </div>
              ) : boardTotal > 0 && (
                <div className="shrink-0 flex items-center justify-center py-1.5 border-t border-[#e0e5eb] dark:border-zinc-800 bg-[#fafafa] dark:bg-zinc-900/50">
                  <span className="text-xs text-[#6c7c93] dark:text-zinc-400">{boardTotal} OS no total</span>
                </div>
              )}
            </div>
          )
      )}

      {/* Lista */}
      {filters.view === 'list' && (
        listFirstLoad
          ? <ListSkeleton />
          : (
            <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-950 mx-4 my-4 rounded-xl border border-[#e0e5eb] dark:border-zinc-800 shadow-sm flex flex-col">
              {/* Barra de info + loading sutil */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#f0f0f0] dark:border-zinc-800 bg-[#fafafa] dark:bg-zinc-900/50 shrink-0">
                <span className="text-xs text-[#6c7c93] dark:text-zinc-400">
                  {listFetching && !listFirstLoad
                    ? 'Buscando...'
                    : `${listTotal} ordem${listTotal !== 1 ? 's' : ''} encontrada${listTotal !== 1 ? 's' : ''}`
                  }
                </span>
                {listFetching && !listFirstLoad && (
                  <span className="h-1 w-24 rounded-full bg-[#e0e5eb] dark:bg-zinc-800 overflow-hidden">
                    <span className="block h-full w-1/2 bg-[#0d4da5] dark:bg-blue-500 rounded-full animate-pulse" />
                  </span>
                )}
              </div>

              <OsList
                orders={listOrders}
                onRowClick={handleCardClick}
              />

              {/* Paginação */}
              {listTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-[#e0e5eb] dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0">
                  <span className="text-xs text-[#6c7c93] dark:text-zinc-400">
                    Página {page} de {listTotalPages}
                  </span>
                  <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-hide">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-7 px-3 rounded text-xs text-[#6c7c93] dark:text-zinc-400 hover:bg-[#f3f4f7] dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-[#e0e5eb] dark:border-zinc-800"
                    >
                      ‹ Anterior
                    </button>

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
                              ? 'bg-[#0d4da5] dark:bg-blue-600 text-white'
                              : 'text-[#6c7c93] dark:text-zinc-400 hover:bg-[#f3f4f7] dark:hover:bg-zinc-800 border border-[#e0e5eb] dark:border-zinc-800'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => setPage((p) => Math.min(listTotalPages, p + 1))}
                      disabled={page >= listTotalPages}
                      className="h-7 px-3 rounded text-xs text-[#6c7c93] dark:text-zinc-400 hover:bg-[#f3f4f7] dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-[#e0e5eb] dark:border-zinc-800"
                    >
                      Próxima ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
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

function BoardSkeleton() {
  return (
    <div className="flex gap-4 px-4 py-4 h-full overflow-x-auto snap-x snap-mandatory">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div key={colIdx} className="w-[85vw] sm:w-72 shrink-0 space-y-3 snap-center">
          <div className="h-10 rounded-xl bg-white dark:bg-zinc-900 border border-[#e0e5eb] dark:border-zinc-800 animate-pulse" />
          {Array.from({ length: 3 - (colIdx % 2) }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-white dark:bg-zinc-900 border border-[#e0e5eb] dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex-1 bg-white dark:bg-zinc-950 mx-4 my-4 rounded-xl border border-[#e0e5eb] dark:border-zinc-800 p-4 space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-[#f3f4f7] dark:bg-zinc-800 animate-pulse" />
      ))}
    </div>
  )
}
