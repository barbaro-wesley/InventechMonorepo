'use client'

import type { ServiceOrder } from '@/services/service-orders/service-orders.types'
import { OsCard } from './os-card'
import { OsColumn } from './os-column'
import { KANBAN_COLUMNS } from './os-utils'

interface OsBoardProps {
  orders: ServiceOrder[]
  onCardClick: (os: ServiceOrder) => void
}

export function OsBoard({ orders, onCardClick }: OsBoardProps) {
  const getColumnOrders = (status: string) =>
    orders.filter((o) => o.status === status)

  return (
    <div className="flex gap-4 h-full overflow-x-auto px-4 py-4">
      {KANBAN_COLUMNS.map((col) => (
        <OsColumn
          key={col.status}
          status={col.status}
          label={col.label}
          headerColor={col.headerColor}
          countBg={col.countBg}
          orders={getColumnOrders(col.status)}
          onCardClick={onCardClick}
        />
      ))}

      {/* Coluna colapsada para reprovadas/canceladas */}
      {(orders.some((o) => o.status === 'COMPLETED_REJECTED') ||
        orders.some((o) => o.status === 'CANCELLED')) && (
        <div className="flex flex-col w-64 shrink-0 opacity-60">
          <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-[#e0e5eb] border-t-2 border-t-slate-300 mb-3 shadow-sm">
            <span className="text-sm font-semibold text-slate-500">Encerradas c/ Problema</span>
            <span className="min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-xs font-bold bg-slate-100 text-slate-500">
              {orders.filter((o) => ['COMPLETED_REJECTED', 'CANCELLED'].includes(o.status)).length}
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pb-2">
            {orders
              .filter((o) => ['COMPLETED_REJECTED', 'CANCELLED'].includes(o.status))
              .map((os) => (
                <OsCard key={os.id} os={os} onClick={() => onCardClick(os)} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

