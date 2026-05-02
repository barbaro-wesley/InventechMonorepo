'use client'

import type { ServiceOrder } from '@/services/service-orders/service-orders.types'

interface QuickStatsBarProps {
  orders: ServiceOrder[]
  isLoading: boolean
}

interface StatItem {
  label: string
  value: number
  color: string
  dot: string
}

export function QuickStatsBar({ orders, isLoading }: QuickStatsBarProps) {
  const stats: StatItem[] = [
    {
      label: 'No Painel',
      value: orders.filter((o) => o.status === 'AWAITING_PICKUP').length,
      color: 'text-orange-700',
      dot: 'bg-orange-500',
    },
    {
      label: 'Atribuídas',
      value: orders.filter((o) => o.status === 'OPEN').length,
      color: 'text-blue-700',
      dot: 'bg-blue-500',
    },
    {
      label: 'Em Andamento',
      value: orders.filter((o) => o.status === 'IN_PROGRESS').length,
      color: 'text-indigo-700',
      dot: 'bg-indigo-500',
    },
    {
      label: 'Aguard. Aprovação',
      value: orders.filter((o) => o.status === 'COMPLETED').length,
      color: 'text-amber-700',
      dot: 'bg-amber-500',
    },
    {
      label: 'Urgentes',
      value: orders.filter(
        (o) => o.priority === 'URGENT' && !['COMPLETED_APPROVED', 'CANCELLED'].includes(o.status),
      ).length,
      color: 'text-red-700',
      dot: 'bg-red-500',
    },
    {
      label: 'Total ativas',
      value: orders.filter(
        (o) => !['COMPLETED_APPROVED', 'CANCELLED'].includes(o.status),
      ).length,
      color: 'text-[#0a3776] dark:text-blue-400 ',
      dot: 'bg-[#0a3776] dark:bg-blue-600',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-zinc-950 border-b border-[#e0e5eb] dark:border-zinc-800 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-md bg-[#f3f4f7] dark:bg-zinc-800 animate-pulse shrink-0" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-zinc-950 border-b border-[#e0e5eb] dark:border-zinc-800 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#f3f4f7] dark:bg-zinc-800 shrink-0"
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${stat.dot}`} />
          <span className="text-xs text-[#6c7c93] dark:text-zinc-400 ">{stat.label}</span>
          <span className={`text-sm font-semibold ${stat.color}`}>{stat.value}</span>
        </div>
      ))}
    </div>
  )
}
