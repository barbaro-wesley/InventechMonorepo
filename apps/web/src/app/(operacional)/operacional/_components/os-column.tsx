'use client'

import type { ServiceOrder } from '@/services/service-orders/service-orders.types'
import { OsCard } from './os-card'

interface OsColumnProps {
  status: string
  label: string
  headerColor: string
  countBg: string
  orders: ServiceOrder[]
  onCardClick: (os: ServiceOrder) => void
}

export function OsColumn({
  label,
  headerColor,
  countBg,
  orders,
  onCardClick,
}: OsColumnProps) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Cabeçalho da coluna */}
      <div
        className={`
          flex items-center justify-between px-3 py-2.5
          bg-white rounded-xl border border-[#e0e5eb] border-t-2 ${headerColor}
          mb-3 shadow-sm
        `}
      >
        <span className="text-sm font-semibold text-[#1d2530]">{label}</span>
        <span
          className={`min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-xs font-bold ${countBg}`}
        >
          {orders.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-0.5 pb-2">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#6c7c93]">
            <div className="h-8 w-8 rounded-full bg-[#f3f4f7] flex items-center justify-center mb-2">
              <span className="text-sm">—</span>
            </div>
            <p className="text-xs">Nenhuma OS aqui</p>
          </div>
        ) : (
          orders.map((os) => (
            <OsCard key={os.id} os={os} onClick={() => onCardClick(os)} />
          ))
        )}
      </div>
    </div>
  )
}
