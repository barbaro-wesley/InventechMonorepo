'use client'

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { ServiceOrder, ServiceOrderStatus } from '@/services/service-orders/service-orders.types'
import { OsCard } from './os-card'
import { OsColumn } from './os-column'
import { KANBAN_COLUMNS, VALID_TRANSITIONS } from './os-utils'
import { useUpdateStatusDnd } from '@/hooks/service-orders/use-service-orders'

interface OsBoardProps {
  orders: ServiceOrder[]
  onCardClick: (os: ServiceOrder) => void
  showClosed?: boolean
  columns?: typeof KANBAN_COLUMNS
}

export function OsBoard({ orders, onCardClick, showClosed = false, columns = KANBAN_COLUMNS }: OsBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, ServiceOrderStatus>>({})

  const updateStatus = useUpdateStatusDnd()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const activeOs = useMemo(
    () => (activeId ? orders.find((o) => o.id === activeId) ?? null : null),
    [activeId, orders],
  )

  // Quais status são destinos válidos para o card sendo arrastado
  const validTargets = useMemo<Set<ServiceOrderStatus>>(
    () => new Set(activeOs ? (VALID_TRANSITIONS[activeOs.status] ?? []) : []),
    [activeOs],
  )

  const ordersWithOverrides = useMemo(
    () => orders.map((o) => (optimisticOverrides[o.id] ? { ...o, status: optimisticOverrides[o.id] } : o)),
    [orders, optimisticOverrides],
  )

  const visibleColumns = showClosed
    ? columns
    : columns.filter((c) => c.status !== 'COMPLETED_APPROVED')

  const closedOrders = ordersWithOverrides.filter((o) =>
    ['COMPLETED_REJECTED', 'CANCELLED'].includes(o.status),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const newStatus = over.id as ServiceOrderStatus
    const os = orders.find((o) => o.id === active.id)
    if (!os || os.status === newStatus) return

    // Bloqueia transições inválidas
    if (!validTargets.has(newStatus)) return

    setOptimisticOverrides((prev) => ({ ...prev, [os.id]: newStatus }))

    updateStatus.mutate(
      { clientId: os.clientId, id: os.id, status: newStatus },
      {
        onSuccess: () => {
          setOptimisticOverrides((prev) => {
            const next = { ...prev }
            delete next[os.id]
            return next
          })
        },
        onError: () => {
          setOptimisticOverrides((prev) => {
            const next = { ...prev }
            delete next[os.id]
            return next
          })
        },
      },
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto px-4 py-4 snap-x snap-mandatory scroll-smooth">
        {visibleColumns.map((col) => (
          <OsColumn
            key={col.status}
            status={col.status}
            label={col.label}
            headerColor={col.headerColor}
            countBg={col.countBg}
            orders={ordersWithOverrides.filter((o) => o.status === col.status)}
            onCardClick={onCardClick}
            isDraggingGlobal={!!activeId}
            isValidTarget={activeId ? validTargets.has(col.status as ServiceOrderStatus) : null}
          />
        ))}

        {/* Coluna colapsada para reprovadas/canceladas */}
        {showClosed && closedOrders.length > 0 && (
          <div className="flex flex-col w-[85vw] sm:w-64 shrink-0 opacity-60 snap-center">
            <div className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-zinc-950 rounded-xl border border-[#e0e5eb] dark:border-zinc-800 border-t-2 border-t-slate-300 dark:border-t-slate-700 mb-3 shadow-sm">
              <span className="text-sm font-semibold text-slate-500">Encerradas c/ Problema</span>
              <span className="min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                {closedOrders.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pb-2">
              {closedOrders.map((os) => (
                <OsCard key={os.id} os={os} onClick={() => onCardClick(os)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeOs ? (
          <div className="rotate-[1.5deg] scale-[1.03] shadow-2xl shadow-black/20 rounded-xl opacity-95 pointer-events-none w-72">
            <OsCard os={activeOs} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
