'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  delta?: { absolute: number; percent: number | null }
  deltaLabel?: string
  icon?: React.ReactNode
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'purple'
  loading?: boolean
}

const accentMap = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   icon: 'text-blue-600 dark:text-blue-400',   bar: 'bg-blue-500' },
  green:  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  amber:  { bg: 'bg-amber-50 dark:bg-amber-900/20',  icon: 'text-amber-600 dark:text-amber-400',  bar: 'bg-amber-500' },
  red:    { bg: 'bg-red-50 dark:bg-red-900/20',    icon: 'text-red-600 dark:text-red-400',    bar: 'bg-red-500' },
  purple: { bg: 'bg-violet-50 dark:bg-violet-900/20', icon: 'text-violet-600 dark:text-violet-400', bar: 'bg-violet-500' },
}

export function KpiCard({
  title,
  value,
  subtitle,
  delta,
  deltaLabel,
  icon,
  accent = 'blue',
  loading = false,
}: KpiCardProps) {
  const colors = accentMap[accent]

  const trendPositive = delta && delta.absolute > 0
  const trendNegative = delta && delta.absolute < 0
  const trendNeutral = !delta || delta.absolute === 0

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#e8ecf1] dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
      <div className={`h-1 w-full ${colors.bar}`} />
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-[#6c7c93] dark:text-zinc-400 uppercase tracking-wide leading-none">
            {title}
          </p>
          {icon && (
            <div className={`h-8 w-8 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
              <span className={colors.icon}>{icon}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-24 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-3.5 w-16 bg-[#f3f4f7] dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-3xl font-bold text-[#1d2530] dark:text-zinc-100 leading-none tracking-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-[#6c7c93] dark:text-zinc-400">{subtitle}</p>
            )}
            {delta && (
              <div
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  trendPositive && 'text-emerald-600',
                  trendNegative && 'text-red-500',
                  trendNeutral && 'text-[#6c7c93] dark:text-zinc-400',
                )}
              >
                {trendPositive && <TrendingUp className="h-3 w-3" />}
                {trendNegative && <TrendingDown className="h-3 w-3" />}
                {trendNeutral && <Minus className="h-3 w-3" />}
                {delta.percent !== null
                  ? `${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%`
                  : delta.absolute > 0 ? '+' + delta.absolute : delta.absolute}
                {deltaLabel && <span className="text-[#6c7c93] dark:text-zinc-400 font-normal ml-0.5">{deltaLabel}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
