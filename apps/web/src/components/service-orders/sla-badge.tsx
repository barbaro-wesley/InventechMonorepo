'use client'

import { Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SlaStatus, ServiceOrderStatus } from '@/services/service-orders/service-orders.types'

interface SlaBadgeProps {
  slaResolutionDueDate?: string | null
  slaStatus?: SlaStatus | null
  status?: ServiceOrderStatus
  className?: string
}

export function SlaBadge({
  slaResolutionDueDate,
  slaStatus,
  status,
  className,
}: SlaBadgeProps) {
  // Se a OS já foi encerrada ou cancelada
  if (status === 'COMPLETED' || status === 'COMPLETED_APPROVED') {
    if (slaStatus === 'COMPLETED_ON_TIME') {
      return (
        <Badge variant="outline" className={`bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 gap-1.5 ${className || ''}`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          SLA Cumprido
        </Badge>
      )
    }
    if (slaStatus === 'COMPLETED_LATE') {
      return (
        <Badge variant="outline" className={`bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 gap-1.5 ${className || ''}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          SLA Fora do Prazo
        </Badge>
      )
    }
  }

  if (status === 'CANCELLED' || status === 'COMPLETED_REJECTED') {
    return null
  }

  if (!slaResolutionDueDate) {
    return null
  }

  const dueDate = new Date(slaResolutionDueDate)
  const now = new Date()
  const diffMs = dueDate.getTime() - now.getTime()
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))

  if (diffMs < 0) {
    const hoursOver = Math.abs(diffHours)
    return (
      <Badge variant="destructive" className={`gap-1.5 font-medium animate-pulse ${className || ''}`}>
        <XCircle className="w-3.5 h-3.5" />
        SLA Atrasado ({hoursOver === 0 ? '<1h' : `${hoursOver}h`})
      </Badge>
    )
  }

  if (diffHours <= 2) {
    return (
      <Badge variant="outline" className={`bg-amber-500 text-white border-amber-600 gap-1.5 ${className || ''}`}>
        <Clock className="w-3.5 h-3.5" />
        SLA Vence em {diffHours === 0 ? '<1h' : `${diffHours}h`}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={`bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 gap-1.5 ${className || ''}`}>
      <Clock className="w-3.5 h-3.5 text-slate-500" />
      SLA em {diffHours}h
    </Badge>
  )
}
