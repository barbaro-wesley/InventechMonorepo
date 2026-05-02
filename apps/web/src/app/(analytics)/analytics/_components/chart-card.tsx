'use client'

import { cn } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

interface ChartCardProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  loading?: boolean
  empty?: boolean
  height?: number
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
  loading = false,
  empty = false,
  height = 260,
}: ChartCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-[#e8ecf1] shadow-sm overflow-hidden', className)}>
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-[#f3f4f7]">
        <div>
          <p className="text-sm font-semibold text-[#1d2530]">{title}</p>
          {subtitle && <p className="text-xs text-[#6c7c93] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="p-4 flex items-center justify-center" style={{ height }}>
        {loading ? (
          <div className="w-full h-full bg-[#f9fafb] rounded-lg animate-pulse" />
        ) : empty ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <BarChart3 className="h-8 w-8 text-[#e0e5eb]" />
            <p className="text-xs text-[#6c7c93]">Sem dados no período</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
