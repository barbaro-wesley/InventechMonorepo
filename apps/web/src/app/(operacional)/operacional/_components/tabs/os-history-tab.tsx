'use client'

import { ArrowRight } from 'lucide-react'
import type { ServiceOrderStatusHistory } from '@/services/service-orders/service-orders.types'
import { STATUS_CONFIG, timeAgo } from '../os-utils'

interface OsHistoryTabProps {
  history: ServiceOrderStatusHistory[]
}

export function OsHistoryTab({ history }: OsHistoryTabProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[#6c7c93]">
        <p className="text-sm">Nenhuma alteração registrada</p>
      </div>
    )
  }

  return (
    <div className="py-1">
      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-3.5 top-3 bottom-3 w-px bg-[#e0e5eb]" />

        <div className="space-y-1">
          {[...history].reverse().map((h, idx) => {
            const toStatus = STATUS_CONFIG[h.toStatus]
            const fromStatus = h.fromStatus ? STATUS_CONFIG[h.fromStatus] : null

            return (
              <div key={h.id} className="flex gap-4 relative">
                {/* Dot */}
                <div
                  className={`h-3 w-3 rounded-full border-2 border-white shadow-sm shrink-0 mt-3.5 z-10 ${toStatus.dot}`}
                />

                {/* Conteúdo */}
                <div className={`flex-1 pb-4 ${idx === 0 ? '' : ''}`}>
                  <div className="bg-white rounded-lg border border-[#e0e5eb] p-3">
                    {/* Transição de status */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {fromStatus && (
                        <>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${fromStatus.bg} ${fromStatus.color}`}
                          >
                            {fromStatus.label}
                          </span>
                          <ArrowRight className="h-3 w-3 text-[#6c7c93] shrink-0" />
                        </>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${toStatus.bg} ${toStatus.color}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${toStatus.dot}`} />
                        {toStatus.label}
                      </span>
                    </div>

                    {/* Motivo */}
                    {h.reason && (
                      <p className="text-xs text-[#6c7c93] mt-1.5 leading-relaxed">
                        "{h.reason}"
                      </p>
                    )}

                    {/* Metadados */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] font-medium text-[#1d2530]">
                        {h.changedBy.name}
                      </span>
                      <span className="text-[10px] text-[#6c7c93]">
                        · {timeAgo(h.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
