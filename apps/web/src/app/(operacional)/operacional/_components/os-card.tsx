'use client'

import { Clock, Wrench, User, MessageSquare, CheckSquare, Paperclip } from 'lucide-react'
import type { ServiceOrder } from '@/services/service-orders/service-orders.types'
import { PRIORITY_CONFIG, STATUS_CONFIG, MAINTENANCE_TYPE_LABELS, timeAgo } from './os-utils'

interface OsCardProps {
  os: ServiceOrder
  onClick: () => void
}

function TechAvatar({ name }: { name: string }) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const color = colors[Math.abs(hash) % colors.length]
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  return (
    <div className={`h-5 w-5 rounded-full ${color} flex items-center justify-center shrink-0`}>
      <span className="text-white text-[9px] font-semibold">{initials}</span>
    </div>
  )
}

export function OsCard({ os, onClick }: OsCardProps) {
  const priority = PRIORITY_CONFIG[os.priority]
  const status = STATUS_CONFIG[os.status]
  const lead = os.technicians.find((t) => t.role === 'LEAD')
  const isUrgent = os.priority === 'URGENT'

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left bg-white rounded-xl border border-[#e0e5eb] shadow-sm
        hover:shadow-md hover:border-[#0d4da5]/30 transition-all duration-150
        overflow-hidden group
        ${isUrgent ? 'ring-1 ring-red-200' : ''}
      `}
    >
      {/* Barra de prioridade */}
      <div className={`h-0.5 w-full ${priority.bar}`} />

      <div className="p-3 space-y-2.5">
        {/* Número + prioridade */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-[#6c7c93]">#{os.number}</span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${priority.badge}`}
            >
              {priority.label}
            </span>
          </div>
          <span
            className={`text-[10px] font-medium ${status.color}`}
          >
            {MAINTENANCE_TYPE_LABELS[os.maintenanceType]}
          </span>
        </div>

        {/* Título */}
        <p className="text-sm font-medium text-[#1d2530] leading-snug line-clamp-2 group-hover:text-[#0a3776]">
          {os.title}
        </p>

        {/* Cliente + equipamento */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[#6c7c93]">
            <User className="h-3 w-3 shrink-0" />
            <span className="text-[11px] truncate">{os.client.name}</span>
          </div>
          <div className="flex items-center gap-1 text-[#6c7c93]">
            <Wrench className="h-3 w-3 shrink-0" />
            <span className="text-[11px] truncate">{os.equipment.name}</span>
          </div>
        </div>

        {/* Grupo */}
        {os.group && (
          <div className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: os.group.color ?? '#94a3b8' }}
            />
            <span className="text-[11px] text-[#6c7c93]">{os.group.name}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5 border-t border-[#f0f0f0]">
          {/* Técnico lead */}
          <div className="flex items-center gap-1">
            {lead ? (
              <>
                <TechAvatar name={lead.technician.name} />
                <span className="text-[11px] text-[#6c7c93] truncate max-w-[80px]">
                  {lead.technician.name.split(' ')[0]}
                </span>
              </>
            ) : (
              <span className="text-[11px] text-orange-500 font-medium">Sem técnico</span>
            )}
          </div>

          {/* Contadores + tempo */}
          <div className="flex items-center gap-2 text-[#6c7c93]">
            {os._count.comments > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <MessageSquare className="h-3 w-3" />
                {os._count.comments}
              </span>
            )}
            {os._count.tasks > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <CheckSquare className="h-3 w-3" />
                {os._count.tasks}
              </span>
            )}
            {os._count.attachments > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <Paperclip className="h-3 w-3" />
                {os._count.attachments}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[10px]">
              <Clock className="h-3 w-3" />
              {timeAgo(os.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
