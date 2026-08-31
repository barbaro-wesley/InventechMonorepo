'use client'

import { useEffect, useState } from 'react'
import { Package, Wrench, Search, RotateCcw, Filter } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { OperacionalFilters } from '@/hooks/use-persisted-filters'
import type {
  ServiceOrderStatus,
  ServiceOrderPriority,
  MaintenanceType,
  SlaStatus,
} from '@/services/service-orders/service-orders.types'
import type { Client } from '@/types/client'
import type { MaintenanceGroup } from '@/services/maintenance-groups/maintenance-groups.service'
import { STATUS_CONFIG, PRIORITY_CONFIG, MAINTENANCE_TYPE_LABELS } from './os-utils'

// Subconjunto dos filtros que o modal edita
export type FilterDraft = Pick<
  OperacionalFilters,
  | 'patrimonyNumber'
  | 'equipmentName'
  | 'clientId'
  | 'status'
  | 'priority'
  | 'groupId'
  | 'maintenanceType'
  | 'slaStatus'
  | 'dateFrom'
  | 'dateTo'
>

const EMPTY_DRAFT: FilterDraft = {
  patrimonyNumber: '',
  equipmentName: '',
  clientId: '',
  status: '',
  priority: '',
  groupId: '',
  maintenanceType: '',
  slaStatus: '',
  dateFrom: '',
  dateTo: '',
}

const STATUS_ORDER: ServiceOrderStatus[] = [
  'AWAITING_PICKUP', 'OPEN', 'IN_PROGRESS', 'COMPLETED',
  'COMPLETED_APPROVED', 'COMPLETED_REJECTED', 'CANCELLED',
]
const PRIORITY_ORDER: ServiceOrderPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
const MAINTENANCE_ORDER: MaintenanceType[] = [
  'PREVENTIVE', 'CORRECTIVE', 'INITIAL_ACCEPTANCE', 'EXTERNAL_SERVICE',
  'TECHNOVIGILANCE', 'TRAINING', 'IMPROPER_USE', 'DEACTIVATION',
]
const SLA_ORDER: SlaStatus[] = [
  'ON_TIME', 'NEAR_BREACH', 'BREACHED', 'COMPLETED_ON_TIME', 'COMPLETED_LATE',
]
const SLA_STATUS_LABELS: Record<SlaStatus, string> = {
  ON_TIME: 'Dentro do prazo',
  NEAR_BREACH: 'Próximo do vencimento',
  BREACHED: 'Estourado',
  COMPLETED_ON_TIME: 'Concluída no prazo',
  COMPLETED_LATE: 'Concluída com atraso',
}

export function draftFrom(filters: OperacionalFilters): FilterDraft {
  return {
    patrimonyNumber: filters.patrimonyNumber,
    equipmentName: filters.equipmentName,
    clientId: filters.clientId,
    status: filters.status,
    priority: filters.priority,
    groupId: filters.groupId,
    maintenanceType: filters.maintenanceType,
    slaStatus: filters.slaStatus,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }
}

export function countActiveFilters(d: FilterDraft): number {
  return Object.values(d).filter((v) => v !== '' && v != null).length
}

interface FiltersModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: OperacionalFilters
  clients: Client[]
  groups: MaintenanceGroup[]
  onApply: (draft: FilterDraft) => void
  onClear: () => void
}

export function FiltersModal({
  open,
  onOpenChange,
  filters,
  clients,
  groups,
  onApply,
  onClear,
}: FiltersModalProps) {
  const [draft, setDraft] = useState<FilterDraft>(() => draftFrom(filters))

  // Ressincroniza o rascunho com os filtros vigentes toda vez que abre
  useEffect(() => {
    if (open) setDraft(draftFrom(filters))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const activeCount = countActiveFilters(draft)

  function upd<K extends keyof FilterDraft>(key: K, value: FilterDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleApply(e?: React.FormEvent) {
    e?.preventDefault()
    onApply(draft)
    onOpenChange(false)
  }

  function handleClear() {
    setDraft(EMPTY_DRAFT)
    onClear()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#0d4da5] dark:text-blue-400" />
            Filtros avançados
          </DialogTitle>
          <DialogDescription>
            Combine os campos para localizar OS específicas no painel.
            <kbd className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              Ctrl/⌘ + K
            </kbd>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleApply} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Nº do patrimônio */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-patrimony" className="text-xs text-[#6c7c93] dark:text-zinc-400">
              Nº do patrimônio
            </Label>
            <div className="relative">
              <Package className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6c7c93] dark:text-zinc-400" />
              <Input
                id="f-patrimony"
                autoFocus
                value={draft.patrimonyNumber}
                onChange={(e) => upd('patrimonyNumber', e.target.value)}
                placeholder="Ex: 001234"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          {/* Nome do equipamento */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-equipment" className="text-xs text-[#6c7c93] dark:text-zinc-400">
              Nome do equipamento
            </Label>
            <div className="relative">
              <Wrench className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6c7c93] dark:text-zinc-400" />
              <Input
                id="f-equipment"
                value={draft.equipmentName}
                onChange={(e) => upd('equipmentName', e.target.value)}
                placeholder="Ex: Ar-condicionado"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          {/* Prestador */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-[#6c7c93] dark:text-zinc-400">Prestador</Label>
            <Select
              value={draft.clientId || 'all'}
              onValueChange={(v) => upd('clientId', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos os prestadores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os prestadores</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-[#6c7c93] dark:text-zinc-400">Status</Label>
            <Select
              value={draft.status || 'all'}
              onValueChange={(v) => upd('status', v === 'all' ? '' : (v as ServiceOrderStatus))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prioridade */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-[#6c7c93] dark:text-zinc-400">Prioridade</Label>
            <Select
              value={draft.priority || 'all'}
              onValueChange={(v) => upd('priority', v === 'all' ? '' : (v as ServiceOrderPriority))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todas as prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                {PRIORITY_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grupo de manutenção */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-[#6c7c93] dark:text-zinc-400">Grupo de manutenção</Label>
            <Select
              value={draft.groupId || 'all'}
              onValueChange={(v) => upd('groupId', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos os grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de manutenção */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-[#6c7c93] dark:text-zinc-400">Tipo de manutenção</Label>
            <Select
              value={draft.maintenanceType || 'all'}
              onValueChange={(v) => upd('maintenanceType', v === 'all' ? '' : (v as MaintenanceType))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {MAINTENANCE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>{MAINTENANCE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Situação do SLA */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-[#6c7c93] dark:text-zinc-400">Situação do SLA</Label>
            <Select
              value={draft.slaStatus || 'all'}
              onValueChange={(v) => upd('slaStatus', v === 'all' ? '' : (v as SlaStatus))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Qualquer situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer situação</SelectItem>
                {SLA_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{SLA_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Período de abertura */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-date-from" className="text-xs text-[#6c7c93] dark:text-zinc-400">
              Aberta a partir de
            </Label>
            <Input
              id="f-date-from"
              type="date"
              value={draft.dateFrom}
              max={draft.dateTo || undefined}
              onChange={(e) => upd('dateFrom', e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-date-to" className="text-xs text-[#6c7c93] dark:text-zinc-400">
              Aberta até
            </Label>
            <Input
              id="f-date-to"
              type="date"
              value={draft.dateTo}
              min={draft.dateFrom || undefined}
              onChange={(e) => upd('dateTo', e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Submit oculto: garante que Enter aplique os filtros */}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>

        <DialogFooter className="items-center sm:justify-between">
          <button
            type="button"
            onClick={handleClear}
            disabled={activeCount === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6c7c93] transition-colors hover:text-red-600 disabled:opacity-40 dark:text-zinc-400 dark:hover:text-red-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
          <Button type="button" onClick={() => handleApply()} className="gap-1.5">
            <Search className="h-3.5 w-3.5" />
            Aplicar{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
