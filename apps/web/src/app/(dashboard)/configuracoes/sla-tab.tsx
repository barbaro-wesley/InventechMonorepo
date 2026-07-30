'use client'

import { useEffect, useState } from 'react'
import { Clock, Loader2, Save, CalendarClock, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

import { slaService } from '@/services/sla/sla.service'
import type { MaintenanceTypeSlaConfig, SlaConfigurableMaintenanceType } from '@/services/sla/sla.service'
import type { CompanySlaConfig, ServiceOrderPriority } from '@/services/service-orders/service-orders.types'
import { formatDurationHours, naturalUnit, toHours, toUnit, type SlaUnit } from '@/lib/sla'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PRIORITY_LABELS: Record<ServiceOrderPriority, { label: string; badge: string }> = {
  URGENT: { label: 'Urgente / Crítica', badge: 'bg-red-100 text-red-700 border-red-200' },
  HIGH:   { label: 'Alta',              badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  MEDIUM: { label: 'Média',             badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  LOW:    { label: 'Baixa',             badge: 'bg-slate-100 text-slate-700 border-slate-200' },
}

const DEFAULT_FALLBACK_CONFIGS: CompanySlaConfig[] = [
  { priority: 'URGENT', maxResponseHours: 1, maxResolutionHours: 4 },
  { priority: 'HIGH',   maxResponseHours: 2, maxResolutionHours: 12 },
  { priority: 'MEDIUM', maxResponseHours: 4, maxResolutionHours: 24 },
  { priority: 'LOW',    maxResponseHours: 8, maxResolutionHours: 72 },
]

const MAINTENANCE_TYPE_LABELS: Record<SlaConfigurableMaintenanceType, string> = {
  PREVENTIVE:         'Preventiva',
  INITIAL_ACCEPTANCE: 'Aceitação Inicial',
  EXTERNAL_SERVICE:   'Serviço Externo',
  TECHNOVIGILANCE:    'Tecnovigilância',
  TRAINING:           'Treinamento',
  IMPROPER_USE:       'Uso Indevido',
  DEACTIVATION:       'Desativação',
}

/** Ordem de exibição das prioridades dentro de cada tipo. */
const PRIORITY_ORDER: ServiceOrderPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

/** Chave de uma célula da matriz. */
const cellKey = (type: string, priority: string) => `${type}:${priority}`

export function SlaTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configs, setConfigs] = useState<CompanySlaConfig[]>([])
  const [typeConfigs, setTypeConfigs] = useState<MaintenanceTypeSlaConfig[]>([])
  // Unidade escolhida por célula/campo. Só afeta a edição — grava sempre em horas.
  const [units, setUnits] = useState<Record<string, SlaUnit>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadConfigs()
  }, [])

  async function loadConfigs() {
    try {
      setLoading(true)
      const [data, byType] = await Promise.all([
        slaService.getSlaConfigs(),
        slaService.getMaintenanceTypeSlaConfigs().catch(() => [] as MaintenanceTypeSlaConfig[]),
      ])
      if (Array.isArray(data) && data.length > 0) {
        setConfigs(data)
      } else {
        setConfigs(DEFAULT_FALLBACK_CONFIGS)
      }
      setTypeConfigs(byType)

      const initialUnits: Record<string, SlaUnit> = {}
      for (const c of byType) {
        initialUnits[cellKey(c.maintenanceType, c.priority) + ':res'] = naturalUnit(c.maxResolutionHours)
        initialUnits[cellKey(c.maintenanceType, c.priority) + ':tpa'] = 'hours'
      }
      setUnits(initialUnits)
    } catch (err) {
      toast.error('Erro ao carregar configurações de SLA')
      setConfigs(DEFAULT_FALLBACK_CONFIGS)
    } finally {
      setLoading(false)
    }
  }

  function handleHoursChange(priority: ServiceOrderPriority, field: 'maxResponseHours' | 'maxResolutionHours', val: string) {
    const num = Math.max(0, Number(val) || 0)
    setConfigs((prev) =>
      prev.map((item) => (item.priority === priority ? { ...item, [field]: num } : item))
    )
  }

  function updateCell(
    type: SlaConfigurableMaintenanceType,
    priority: ServiceOrderPriority,
    patch: Partial<MaintenanceTypeSlaConfig>,
  ) {
    setTypeConfigs((prev) =>
      prev.map((item) =>
        item.maintenanceType === type && item.priority === priority ? { ...item, ...patch } : item,
      ),
    )
  }

  function handleResolutionChange(
    type: SlaConfigurableMaintenanceType,
    priority: ServiceOrderPriority,
    val: string,
    unit: SlaUnit,
  ) {
    updateCell(type, priority, {
      maxResolutionHours: Math.max(1, Math.round(toHours(Number(val) || 0, unit))),
    })
  }

  function handleTpaChange(
    type: SlaConfigurableMaintenanceType,
    priority: ServiceOrderPriority,
    val: string,
    unit: SlaUnit,
  ) {
    // Campo vazio = sem prazo de primeiro atendimento.
    const trimmed = val.trim()
    if (trimmed === '') {
      updateCell(type, priority, { maxResponseHours: null })
      return
    }
    updateCell(type, priority, {
      maxResponseHours: Math.max(0, Math.round(toHours(Number(trimmed) || 0, unit))),
    })
  }

  function handleUnitChange(key: string, unit: SlaUnit, currentHours: number | null) {
    setUnits((prev) => ({ ...prev, [key]: unit }))

    // Ao passar para dias, arredonda para dias inteiros — senão um prazo de 25h
    // apareceria como "1,0416" no campo.
    if (unit === 'days' && currentHours != null && currentHours % 24 !== 0) {
      const [type, priority, field] = key.split(':') as [
        SlaConfigurableMaintenanceType,
        ServiceOrderPriority,
        'res' | 'tpa',
      ]
      const snapped = Math.max(24, Math.round(currentHours / 24) * 24)
      updateCell(type, priority, field === 'res' ? { maxResolutionHours: snapped } : { maxResponseHours: snapped })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSaving(true)
      const [updated, updatedTypes] = await Promise.all([
        slaService.updateSlaConfigs(configs),
        typeConfigs.length > 0
          ? slaService.updateMaintenanceTypeSlaConfigs(typeConfigs)
          : Promise.resolve(typeConfigs),
      ])
      setConfigs(updated)
      setTypeConfigs(updatedTypes)
      toast.success('Configurações de SLA salvas com sucesso!')
    } catch (err) {
      toast.error('Falha ao salvar configurações de SLA')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  // Agrupa a matriz por tipo, preservando a ordem de prioridade.
  const typeGroups = (Object.keys(MAINTENANCE_TYPE_LABELS) as SlaConfigurableMaintenanceType[])
    .map((type) => ({
      type,
      cells: PRIORITY_ORDER.map((priority) =>
        typeConfigs.find((c) => c.maintenanceType === type && c.priority === priority),
      ).filter((c): c is MaintenanceTypeSlaConfig => !!c),
    }))
    .filter((g) => g.cells.length > 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">SLA de Corretivas por Prioridade</h3>
            <p className="text-sm text-muted-foreground">
              Configure o tempo máximo (em horas) para o primeiro atendimento (TPA) e para a resolução completa das Ordens de Serviço corretivas, conforme a prioridade do chamado.
            </p>
          </div>
        </div>

        <div className="grid gap-6 pt-4">
          {configs.map((config) => {
            const meta = PRIORITY_LABELS[config.priority] || { label: config.priority, badge: '' }
            return (
              <div
                key={config.priority}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 items-center"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`font-semibold ${meta.badge}`}>
                    {meta.label}
                  </Badge>
                  {config.isCustomized && (
                    <span className="text-xs text-emerald-600 font-medium">(Customizado)</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Primeiro Atendimento — TPA (Horas)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={config.maxResponseHours}
                    onChange={(e) => handleHoursChange(config.priority, 'maxResponseHours', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prazo de Conclusão / Resolução (Horas)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={config.maxResolutionHours}
                    onChange={(e) => handleHoursChange(config.priority, 'maxResolutionHours', e.target.value)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base">SLA por Tipo de Manutenção e Prioridade</h3>
            <p className="text-sm text-muted-foreground">
              TPA e prazo de conclusão de cada tipo de OS, por prioridade do chamado. Corretiva não aparece aqui — o prazo dela vem do card acima. Deixe o TPA vazio para que o tipo não tenha prazo de primeiro atendimento.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          {typeGroups.map(({ type, cells }) => {
            const isOpen = expanded[type] ?? false
            const resolutions = cells.map((c) => c.maxResolutionHours)
            const min = Math.min(...resolutions)
            const max = Math.max(...resolutions)
            const summary =
              min === max
                ? formatDurationHours(min)
                : `${formatDurationHours(min)} – ${formatDurationHours(max)}`
            const withTpa = cells.filter((c) => c.maxResponseHours != null).length

            return (
              <div key={type} className="rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [type]: !isOpen }))}
                  className="w-full flex items-center gap-3 p-4 text-left bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                  )}
                  <Badge variant="outline" className="font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">
                    {MAINTENANCE_TYPE_LABELS[type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Conclusão: <span className="font-semibold text-foreground">{summary}</span>
                    {withTpa > 0 && ` · TPA em ${withTpa}/4`}
                  </span>
                </button>

                {isOpen && (
                  <div className="divide-y">
                    {cells.map((cell) => {
                      const meta = PRIORITY_LABELS[cell.priority]
                      const resKey = cellKey(type, cell.priority) + ':res'
                      const tpaKey = cellKey(type, cell.priority) + ':tpa'
                      const resUnit = units[resKey] ?? naturalUnit(cell.maxResolutionHours)
                      const tpaUnit = units[tpaKey] ?? 'hours'

                      return (
                        <div
                          key={cell.priority}
                          className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] gap-4 p-4 items-start"
                        >
                          <div className="flex items-center gap-2 md:pt-6">
                            <Badge variant="outline" className={`font-semibold ${meta.badge}`}>
                              {meta.label}
                            </Badge>
                            {cell.isCustomized && (
                              <span className="text-xs text-emerald-600 font-medium">(Customizado)</span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Primeiro Atendimento — TPA</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                placeholder="Sem prazo"
                                value={
                                  cell.maxResponseHours == null
                                    ? ''
                                    : toUnit(cell.maxResponseHours, tpaUnit)
                                }
                                onChange={(e) => handleTpaChange(type, cell.priority, e.target.value, tpaUnit)}
                                className="flex-1"
                              />
                              <Select
                                value={tpaUnit}
                                onValueChange={(v) => handleUnitChange(tpaKey, v as SlaUnit, cell.maxResponseHours)}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hours">Horas</SelectItem>
                                  <SelectItem value="days">Dias</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {cell.maxResponseHours == null
                                ? 'Sem prazo de primeiro atendimento.'
                                : `Equivale a ${formatDurationHours(cell.maxResponseHours)}.`}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Prazo de Conclusão</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={toUnit(cell.maxResolutionHours, resUnit)}
                                onChange={(e) => handleResolutionChange(type, cell.priority, e.target.value, resUnit)}
                                className="flex-1"
                              />
                              <Select
                                value={resUnit}
                                onValueChange={(v) => handleUnitChange(resKey, v as SlaUnit, cell.maxResolutionHours)}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hours">Horas</SelectItem>
                                  <SelectItem value="days">Dias</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Equivale a {formatDurationHours(cell.maxResolutionHours)}.
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Configurações de SLA
        </Button>
      </div>
    </form>
  )
}
