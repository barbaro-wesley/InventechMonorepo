'use client'

import { Search, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ServiceOrderPriority } from '@/services/service-orders/service-orders.types'

interface TecnicoCommandBarProps {
  search: string
  onSearchChange: (s: string) => void
  priority: ServiceOrderPriority | ''
  onPriorityChange: (p: ServiceOrderPriority | '') => void
  onRefresh: () => void
  isRefreshing: boolean
}

export function TecnicoCommandBar({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  onRefresh,
  isRefreshing,
}: TecnicoCommandBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-[#e0e5eb]">
      {/* Busca */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6c7c93]" />
        <Input
          placeholder="Buscar por título, cliente, equipamento..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm bg-[#f3f4f7] border-transparent focus:border-[#0d4da5] focus:bg-white"
        />
      </div>

      {/* Filtro prioridade */}
      <Select
        value={priority || 'all'}
        onValueChange={(v) => onPriorityChange(v === 'all' ? '' : (v as ServiceOrderPriority))}
      >
        <SelectTrigger className="h-8 w-36 text-xs bg-[#f3f4f7] border-transparent">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="URGENT">🔴 Urgente</SelectItem>
          <SelectItem value="HIGH">🟠 Alta</SelectItem>
          <SelectItem value="MEDIUM">🔵 Média</SelectItem>
          <SelectItem value="LOW">⚪ Baixa</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex-1" />

      {/* Atualizar */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-[#f3f4f7] text-[#6c7c93] hover:text-[#1d2530] transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        Atualizar
      </button>
    </div>
  )
}
