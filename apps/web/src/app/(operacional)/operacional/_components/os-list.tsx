'use client'

import { Clock, Wrench } from 'lucide-react'
import type { ServiceOrder } from '@/services/service-orders/service-orders.types'
import { PRIORITY_CONFIG, STATUS_CONFIG, MAINTENANCE_TYPE_LABELS, timeAgo } from './os-utils'

interface OsListProps {
  orders: ServiceOrder[]
  onRowClick: (os: ServiceOrder) => void
}

export function OsList({ orders, onRowClick }: OsListProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#6c7c93]">
        <Wrench className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhuma OS encontrada</p>
        <p className="text-xs mt-1">Tente ajustar os filtros</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white border-b border-[#e0e5eb] z-10">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#6c7c93] w-16">#</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#6c7c93]">Título</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#6c7c93] hidden md:table-cell">Cliente</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#6c7c93] hidden lg:table-cell">Tipo</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#6c7c93]">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#6c7c93]">Prioridade</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#6c7c93] hidden lg:table-cell">Técnico</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[#6c7c93] hidden md:table-cell">Criada</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f0f0]">
          {orders.map((os) => {
            const priority = PRIORITY_CONFIG[os.priority]
            const status = STATUS_CONFIG[os.status]
            const lead = os.technicians.find((t) => t.role === 'LEAD')

            return (
              <tr
                key={os.id}
                onClick={() => onRowClick(os)}
                className="hover:bg-[#f8f9fb] cursor-pointer transition-colors group"
              >
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-[#6c7c93] group-hover:text-[#0a3776]">
                    #{os.number}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${priority.bar}`} />
                    <div>
                      <p className="font-medium text-[#1d2530] line-clamp-1 group-hover:text-[#0a3776] text-sm">
                        {os.title}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 text-[#6c7c93]">
                        <Wrench className="h-3 w-3" />
                        <span className="text-xs truncate max-w-[200px]">{os.equipment.name}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-[#6c7c93]">{os.client.name}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-[#6c7c93]">
                    {MAINTENANCE_TYPE_LABELS[os.maintenanceType]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${status.bg} ${status.color}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${priority.badge}`}
                  >
                    {priority.label}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {lead ? (
                    <span className="text-xs text-[#6c7c93]">{lead.technician.name}</span>
                  ) : (
                    <span className="text-xs text-orange-500">Sem técnico</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="flex items-center gap-1 text-xs text-[#6c7c93]">
                    <Clock className="h-3 w-3" />
                    {timeAgo(os.createdAt)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
