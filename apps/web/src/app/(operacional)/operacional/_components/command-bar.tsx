'use client'

import { Search, LayoutGrid, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ServiceOrderStatus, ServiceOrderPriority } from '@/services/service-orders/service-orders.types'

export type ViewMode = 'board' | 'list'

interface CommandBarProps {
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  search: string
  onSearchChange: (s: string) => void
  status: ServiceOrderStatus | ''
  onStatusChange: (s: ServiceOrderStatus | '') => void
  priority: ServiceOrderPriority | ''
  onPriorityChange: (p: ServiceOrderPriority | '') => void
}

export function CommandBar({
  view,
  onViewChange,
  search,
  onSearchChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
}: CommandBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-[#e0e5eb]">
      {/* Busca */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6c7c93]" />
        <Input
          placeholder="Buscar OS, equipamento, cliente..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm bg-[#f3f4f7] border-transparent focus:border-[#0d4da5] focus:bg-white"
        />
      </div>

      {/* Filtro status */}
      <Select
        value={status || 'all'}
        onValueChange={(v) => onStatusChange(v === 'all' ? '' : (v as ServiceOrderStatus))}
      >
        <SelectTrigger className="h-8 w-40 text-xs bg-[#f3f4f7] border-transparent">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="AWAITING_PICKUP">No Painel</SelectItem>
          <SelectItem value="OPEN">Atribuídas</SelectItem>
          <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
          <SelectItem value="COMPLETED">Aguard. Aprovação</SelectItem>
          <SelectItem value="COMPLETED_APPROVED">Aprovadas</SelectItem>
          <SelectItem value="COMPLETED_REJECTED">Reprovadas</SelectItem>
          <SelectItem value="CANCELLED">Canceladas</SelectItem>
        </SelectContent>
      </Select>

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

      {/* Toggle view */}
      <div className="flex items-center rounded-md border border-[#e0e5eb] bg-[#f3f4f7] p-0.5">
        <button
          onClick={() => onViewChange('board')}
          className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
            view === 'board'
              ? 'bg-white text-[#0a3776] shadow-sm font-medium'
              : 'text-[#6c7c93] hover:text-[#1d2530]'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Board</span>
        </button>
        <button
          onClick={() => onViewChange('list')}
          className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
            view === 'list'
              ? 'bg-white text-[#0a3776] shadow-sm font-medium'
              : 'text-[#6c7c93] hover:text-[#1d2530]'
          }`}
        >
          <List className="h-3.5 w-3.5" />
          <span>Lista</span>
        </button>
      </div>

    </div>
  )
}
