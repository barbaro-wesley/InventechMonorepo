'use client'

import { useDroppable, useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { ServiceOrder, ServiceOrderStatus } from '@/services/service-orders/service-orders.types'
import { OsCard } from './os-card'

// ── Draggable wrapper ─────────────────────────────────────────────────────────

const NON_DRAGGABLE: ServiceOrderStatus[] = ['COMPLETED_REJECTED', 'CANCELLED', 'COMPLETED_APPROVED']

function DraggableCard({ os, onClick }: { os: ServiceOrder; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: os.id,
    data: { os },
    disabled: NON_DRAGGABLE.includes(os.status),
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'touch-none select-none',
        NON_DRAGGABLE.includes(os.status) ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-20 pointer-events-none',
      )}
    >
      <OsCard os={os} onClick={onClick} />
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

interface OsColumnProps {
  status: string
  label: string
  headerColor: string
  countBg: string
  orders: ServiceOrder[]
  onCardClick: (os: ServiceOrder) => void
  isDraggingGlobal?: boolean
  /** null = sem arrasto ativo; true = destino válido; false = destino inválido */
  isValidTarget?: boolean | null
}

export function OsColumn({
  status,
  label,
  headerColor,
  countBg,
  orders,
  onCardClick,
  isDraggingGlobal,
  isValidTarget,
}: OsColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: isValidTarget === false,
  })

  const dragging = isDraggingGlobal && isValidTarget !== null
  const locked = dragging && isValidTarget === false
  const valid = dragging && isValidTarget === true

  return (
    <div
      className={cn(
        'flex flex-col w-[85vw] sm:w-72 shrink-0 snap-center transition-opacity duration-150',
        locked && 'opacity-40',
      )}
    >
      {/* Cabeçalho */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2.5 mb-3',
          'bg-white dark:bg-zinc-950 rounded-xl shadow-sm',
          'border border-[#e0e5eb] dark:border-zinc-800 border-t-2',
          headerColor,
          'transition-all duration-150',
          isOver && 'ring-2 ring-inset ring-blue-400/50',
          valid && !isOver && 'ring-1 ring-inset ring-emerald-400/40',
        )}
      >
        <span className="text-sm font-semibold text-[#1d2530] dark:text-zinc-100">{label}</span>
        <div className="flex items-center gap-1.5">
          {valid && (
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
              Soltar aqui
            </span>
          )}
          <span className={`min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-xs font-bold ${countBg}`}>
            {orders.length}
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto pr-0.5 pb-2 rounded-xl transition-all duration-150 min-h-[80px] p-1',
          isOver
            ? 'bg-blue-50/70 dark:bg-blue-900/10 ring-2 ring-blue-300/60 dark:ring-blue-700/40 ring-dashed'
            : valid
              ? 'ring-1 ring-dashed ring-emerald-300/50 dark:ring-emerald-700/40'
              : '',
        )}
      >
        {orders.length === 0 ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center py-10 rounded-lg transition-colors duration-150',
              isOver ? 'text-blue-500' : valid ? 'text-emerald-500' : 'text-[#6c7c93] dark:text-zinc-500',
            )}
          >
            <div
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center mb-2 text-base transition-colors',
                isOver
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : valid
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : 'bg-[#f3f4f7] dark:bg-zinc-800',
              )}
            >
              {isOver ? '↓' : valid ? '✓' : '—'}
            </div>
            <p className="text-xs font-medium">
              {isOver ? 'Soltar aqui' : valid ? 'Disponível' : 'Nenhuma OS'}
            </p>
          </div>
        ) : (
          orders.map((os) => (
            <DraggableCard key={os.id} os={os} onClick={() => onCardClick(os)} />
          ))
        )}
      </div>
    </div>
  )
}
