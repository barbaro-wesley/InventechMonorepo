'use client'

import { useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useQueryClient } from '@tanstack/react-query'

export interface AnalyticsFilters {
  startDate: string
  endDate: string
  clientId?: string
  groupId?: string
}

interface FilterBarProps {
  filters: AnalyticsFilters
  onChange: (filters: AnalyticsFilters) => void
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '12m', days: 365 },
]

function subtractDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  function applyPreset(days: number) {
    onChange({ ...filters, startDate: subtractDays(days), endDate: today() })
  }

  async function refresh() {
    setRefreshing(true)
    await qc.invalidateQueries({ queryKey: ['analytics'] })
    setTimeout(() => setRefreshing(false), 600)
  }

  const activePreset = PRESETS.find(
    (p) =>
      filters.startDate === subtractDays(p.days) &&
      filters.endDate === today(),
  )

  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-[#e8ecf1] flex-wrap">
      <CalendarDays className="h-4 w-4 text-[#6c7c93] shrink-0" />

      {/* Quick presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activePreset?.days === p.days
                ? 'bg-[#0a3776] text-white'
                : 'bg-[#f3f4f7] text-[#6c7c93] hover:bg-[#e8ecf1] hover:text-[#1d2530]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-[#e0e5eb] shrink-0" />

      {/* Custom range */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-[#6c7c93] whitespace-nowrap">De</Label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
            className="h-7 text-xs w-36 border-[#e0e5eb]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-[#6c7c93] whitespace-nowrap">Até</Label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
            className="h-7 text-xs w-36 border-[#e0e5eb]"
          />
        </div>
      </div>

      <div className="ml-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          className="h-7 gap-1.5 text-[#6c7c93] hover:text-[#0a3776] text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    </div>
  )
}
