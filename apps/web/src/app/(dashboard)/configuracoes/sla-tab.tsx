'use client'

import { useEffect, useState } from 'react'
import { Clock, Loader2, Save, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'

import { slaService } from '@/services/sla/sla.service'
import type { CompanySlaConfig, ServiceOrderPriority } from '@/services/service-orders/service-orders.types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

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

const DEFAULT_PREVENTIVE_DAYS = 30

export function SlaTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configs, setConfigs] = useState<CompanySlaConfig[]>([])
  const [preventiveDays, setPreventiveDays] = useState<number>(DEFAULT_PREVENTIVE_DAYS)

  useEffect(() => {
    loadConfigs()
  }, [])

  async function loadConfigs() {
    try {
      setLoading(true)
      const [data, preventive] = await Promise.all([
        slaService.getSlaConfigs(),
        slaService.getPreventiveSla().catch(() => ({ executionDays: DEFAULT_PREVENTIVE_DAYS })),
      ])
      if (Array.isArray(data) && data.length > 0) {
        setConfigs(data)
      } else {
        setConfigs(DEFAULT_FALLBACK_CONFIGS)
      }
      setPreventiveDays(preventive?.executionDays ?? DEFAULT_PREVENTIVE_DAYS)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSaving(true)
      const [updated] = await Promise.all([
        slaService.updateSlaConfigs(configs),
        slaService.updatePreventiveSla(Math.max(1, Math.round(preventiveDays) || DEFAULT_PREVENTIVE_DAYS)),
      ])
      setConfigs(updated)
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
            <h3 className="font-semibold text-base">SLA de Execução das Preventivas</h3>
            <p className="text-sm text-muted-foreground">
              Prazo máximo (em dias) para a conclusão de uma OS preventiva após a abertura automática. Após esse período a OS é classificada como atrasada.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 items-center">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">
              Preventiva
            </Badge>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Prazo de Conclusão (Dias)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              step={1}
              value={preventiveDays}
              onChange={(e) => setPreventiveDays(Math.max(1, Number(e.target.value) || 0))}
            />
          </div>
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
