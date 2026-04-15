'use client'

import { useState, useMemo, useEffect } from 'react'
import { useCurrentUser } from '@/store/auth.store'
import { useServiceOrders } from '@/hooks/service-orders/use-service-orders'
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

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ServiceOrderStatus | ''>('')
  const [priority, setPriority] = useState<ServiceOrderPriority | ''>('')
  const [view, setView] = useState<ViewMode>('board')
  const [myOrders, setMyOrders] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [page, setPage] = useState(1)

  // Board load more
  const [boardPage, setBoardPage] = useState(1)
  const [allBoardOrders, setAllBoardOrders] = useState<ServiceOrder[]>([])

  // Debounce para busca server-side em ambas as views
  const debouncedSearch = useDebounce(search, 350)
  const isTyping = search !== debouncedSearch

  // Reseta paginação da lista quando filtros mudam
  useEffect(() => { setPage(1) }, [debouncedSearch, status, priority])

  // Reseta board quando filtros/busca mudam
  useEffect(() => { setBoardPage(1) }, [debouncedSearch, status, priority])

  const [selectedOs, setSelectedOs] = useState<{ id: string; clientId: string } | null>(null)

  // ── Board: busca + filtros server-side, com suporte a "carregar mais" ────────
  const { data: boardResponse, isLoading: boardLoading, isFetching: boardFetching } = useServiceOrders(
    view === 'board'
      ? { search: debouncedSearch || undefined, status: status || undefined, priority: priority || undefined, limit: BOARD_PAGE_SIZE, page: boardPage }
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

  // ── Lista: tudo server-side com paginação ────────────────────────────────────
  const { data: listResponse, isLoading: listFirstLoad, isFetching: listFetching } = useServiceOrders(
    view === 'list'
      ? { search: debouncedSearch || undefined, status: status || undefined, priority: priority || undefined, limit: LIST_PAGE_SIZE, page }
      : null
  )

  const listOrders: ServiceOrder[] = listResponse?.data ?? []
  const listTotal = listResponse?.pagination?.total ?? 0
  const listTotalPages = listResponse?.pagination?.totalPages ?? 1

  // Filtro client-side no board — apenas "Minhas OS" (busca é server-side)
  const filteredBoard = useMemo(() => {
    if (!myOrders || !user) return allBoardOrders
    return allBoardOrders.filter((os) =>
      os.technicians.some((t) => t.technician.id === user.id)
    )
  }, [allBoardOrders, myOrders, user])

  const handleCardClick = (os: ServiceOrder) =>
    setSelectedOs({ id: os.id, clientId: os.client?.id ?? os.clientId ?? '' })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <QuickStatsBar orders={allBoardOrders} isLoading={boardLoading} />

      <CommandBar
        view={view}
        onViewChange={(v) => { setView(v); setPage(1) }}
        search={search}
        onSearchChange={setSearch}
        isTyping={isTyping}
        status={status}
        onStatusChange={(v) => { setStatus(v); setPage(1) }}
        priority={priority}
        onPriorityChange={(v) => { setPriority(v); setPage(1) }}
        myOrders={myOrders}
        onMyOrdersChange={setMyOrders}
        showClosed={showClosed}
        onShowClosedChange={setShowClosed}
      />

      {/* Board */}
      {view === 'board' && (
        boardLoading
          ? <BoardSkeleton />
          : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Barra de loading sutil ao refetching */}
              {boardFetching && !boardLoading && (
                <div className="shrink-0 h-0.5 w-full bg-[#e0e5eb] overflow-hidden">
                  <div className="h-full w-1/2 bg-[#0d4da5] rounded-full animate-pulse" />
                </div>
              )}
              <OsBoard orders={filteredBoard} showClosed={showClosed} onCardClick={handleCardClick} />

              {/* Footer do board: total + carregar mais */}
              {(boardHasMore || boardFetching) ? (
                <div className="shrink-0 flex items-center justify-center gap-3 py-2 border-t border-[#e0e5eb] bg-white">
                  <span className="text-xs text-[#6c7c93]">
                    Exibindo {allBoardOrders.length} de {boardTotal} OS
                  </span>
                  <button
                    onClick={() => setBoardPage(p => p + 1)}
                    disabled={boardFetching}
                    className="h-7 px-4 rounded text-xs font-medium text-[#0d4da5] border border-[#0d4da5] hover:bg-[#f0f4ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {boardFetching ? 'Carregando...' : 'Carregar mais'}
                  </button>
                </div>
              ) : boardTotal > 0 && (
                <div className="shrink-0 flex items-center justify-center py-1.5 border-t border-[#e0e5eb] bg-[#fafafa]">
                  <span className="text-xs text-[#6c7c93]">{boardTotal} OS no total</span>
                </div>
              )}
            </div>
          )
      )}

      {/* Lista */}
      {view === 'list' && (
        listFirstLoad
          ? <ListSkeleton />
          : (
            <div className="flex-1 overflow-hidden bg-white mx-4 my-4 rounded-xl border border-[#e0e5eb] shadow-sm flex flex-col">
              {/* Barra de info + loading sutil */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#f0f0f0] bg-[#fafafa] shrink-0">
                <span className="text-xs text-[#6c7c93]">
                  {listFetching && !listFirstLoad
                    ? 'Buscando...'
                    : `${listTotal} ordem${listTotal !== 1 ? 's' : ''} encontrada${listTotal !== 1 ? 's' : ''}`
                  }
                </span>
                {listFetching && !listFirstLoad && (
                  <span className="h-1 w-24 rounded-full bg-[#e0e5eb] overflow-hidden">
                    <span className="block h-full w-1/2 bg-[#0d4da5] rounded-full animate-pulse" />
                  </span>
                )}
              </div>

              <OsList
                orders={listOrders}
                onRowClick={handleCardClick}
              />

              {/* Paginação */}
              {listTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#e0e5eb] bg-white shrink-0">
                  <span className="text-xs text-[#6c7c93]">
                    Página {page} de {listTotalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-7 px-3 rounded text-xs text-[#6c7c93] hover:bg-[#f3f4f7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-[#e0e5eb]"
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
                              ? 'bg-[#0d4da5] text-white'
                              : 'text-[#6c7c93] hover:bg-[#f3f4f7] border border-[#e0e5eb]'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => setPage((p) => Math.min(listTotalPages, p + 1))}
                      disabled={page >= listTotalPages}
                      className="h-7 px-3 rounded text-xs text-[#6c7c93] hover:bg-[#f3f4f7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-[#e0e5eb]"
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

function ListSkeleton() {
  return (
    <div className="flex-1 bg-white mx-4 my-4 rounded-xl border border-[#e0e5eb] p-4 space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-[#f3f4f7] animate-pulse" />
      ))}
    </div>
  )
}
